/**
 * Rate Limit Settings API
 *
 * GET  /api/admin/tenants/[id]/rate-limit - Get rate limit settings
 * PATCH /api/admin/tenants/[id]/rate-limit - Update rate limit settings
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import {
  cacheTenantRateLimit,
  invalidateTenantRateLimitCache,
} from "@/lib/services/tenant-rate-limit.service";
import { isValidCidr } from "@/lib/utils/cidr";

const DEFAULT_RATE_LIMIT = {
  enabled: false,
  requests_per_minute: 0,
  requests_per_day: 0,
  max_concurrent: 0,
  per_ip_enabled: true,
  per_ip_requests_per_minute: 120,
  per_ip_requests_per_day: 20000,
  per_ip_max_concurrent: 20,
  per_ip_allowlist: [] as string[],
};

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
    const TenantModel = await getTenantModel();
    const tenant = await TenantModel.findByTenantId(id);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      rate_limit: {
        ...DEFAULT_RATE_LIMIT,
        ...tenant.settings?.rate_limit,
      },
    });
  } catch (error: unknown) {
    console.error("[Admin] Error fetching rate limit:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate limit settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const {
      enabled,
      requests_per_minute = 0,
      requests_per_day = 0,
      max_concurrent = 0,
      per_ip_enabled = true,
      per_ip_requests_per_minute = 0,
      per_ip_requests_per_day = 0,
      per_ip_max_concurrent = 0,
      per_ip_allowlist = [],
    } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    if (typeof per_ip_enabled !== "boolean") {
      return NextResponse.json(
        { error: "per_ip_enabled must be a boolean" },
        { status: 400 }
      );
    }

    const validateNumber = (val: unknown, name: string) => {
      if (val !== undefined && (typeof val !== "number" || val < 0)) {
        return `${name} must be a non-negative number`;
      }
      return null;
    };

    const errors = [
      validateNumber(requests_per_minute, "requests_per_minute"),
      validateNumber(requests_per_day, "requests_per_day"),
      validateNumber(max_concurrent, "max_concurrent"),
      validateNumber(per_ip_requests_per_minute, "per_ip_requests_per_minute"),
      validateNumber(per_ip_requests_per_day, "per_ip_requests_per_day"),
      validateNumber(per_ip_max_concurrent, "per_ip_max_concurrent"),
    ].filter(Boolean);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    if (!Array.isArray(per_ip_allowlist) || per_ip_allowlist.some((v) => typeof v !== "string")) {
      return NextResponse.json(
        { error: "per_ip_allowlist must be an array of strings" },
        { status: 400 }
      );
    }

    const invalidCidrs = (per_ip_allowlist as string[]).filter((c) => !isValidCidr(c));
    if (invalidCidrs.length > 0) {
      return NextResponse.json(
        { error: "Invalid CIDR(s)", invalid_cidrs: invalidCidrs },
        { status: 400 }
      );
    }

    const finalSettings = {
      enabled,
      requests_per_minute: enabled ? requests_per_minute : 0,
      requests_per_day: enabled ? requests_per_day : 0,
      max_concurrent: enabled ? max_concurrent : 0,
      per_ip_enabled,
      per_ip_requests_per_minute: per_ip_enabled ? per_ip_requests_per_minute : 0,
      per_ip_requests_per_day: per_ip_enabled ? per_ip_requests_per_day : 0,
      per_ip_max_concurrent: per_ip_enabled ? per_ip_max_concurrent : 0,
      per_ip_allowlist: per_ip_allowlist as string[],
    };

    const TenantModel = await getTenantModel();
    const tenant = await TenantModel.findOneAndUpdate(
      { tenant_id: id.toLowerCase() },
      { $set: { "settings.rate_limit": finalSettings } },
      { new: true }
    );

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await invalidateTenantRateLimitCache(id);
    await cacheTenantRateLimit(id, finalSettings);

    return NextResponse.json({
      success: true,
      rate_limit: tenant.settings?.rate_limit,
    });
  } catch (error: unknown) {
    console.error("[Admin] Error updating rate limit:", error);
    return NextResponse.json(
      { error: "Failed to update rate limit settings" },
      { status: 500 }
    );
  }
}
