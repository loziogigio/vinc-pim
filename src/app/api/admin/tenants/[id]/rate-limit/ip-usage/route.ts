/**
 * Per-IP Rate Limit Usage Probe (admin only)
 *
 * GET /api/admin/tenants/[id]/rate-limit/ip-usage?ip=<addr>
 * Read-only — never increments counters.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import { getPerIpRateLimitStatus } from "@/lib/services/tenant-rate-limit.service";
import { normalizeIp } from "@/lib/utils/client-ip";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const rawIp = req.nextUrl.searchParams.get("ip");
    if (!rawIp) {
      return NextResponse.json({ error: "ip query parameter is required" }, { status: 400 });
    }

    const normalized = normalizeIp(rawIp);
    if (normalized === "unknown") {
      return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findByTenantId(id);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = tenant.settings?.rate_limit ?? null;
    const [web, api] = await Promise.all([
      getPerIpRateLimitStatus(id, settings, normalized, "web"),
      getPerIpRateLimitStatus(id, settings, normalized, "api"),
    ]);

    return NextResponse.json({
      ip: rawIp,
      normalized,
      allowlisted: web.allowlisted,
      web: { ip_minute: web.ip_minute, ip_day: web.ip_day },
      api: { ip_minute: api.ip_minute, ip_day: api.ip_day },
      ip_concurrent: web.ip_concurrent, // shared across tiers
      // Back-compat: callers built against the pre-tier shape still see web counters here.
      ip_minute: web.ip_minute,
      ip_day: web.ip_day,
    });
  } catch (error: unknown) {
    console.error("[Admin] Error probing IP usage:", error);
    return NextResponse.json({ error: "Failed to probe IP usage" }, { status: 500 });
  }
}
