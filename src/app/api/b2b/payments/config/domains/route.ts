/**
 * Tenant Domains for Webhook Configuration
 *
 * GET /api/b2b/payments/config/domains
 *
 * Returns the current tenant's configured domains so the user
 * can select one to build a webhook URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getTenant } from "@/lib/services/admin-tenant.service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const tenant = await getTenant(auth.tenantId);

    const domains = (tenant?.domains ?? [])
      .filter((d) => d.is_active !== false)
      .map((d) => ({
        hostname: d.hostname,
        protocol: d.protocol || "https",
        is_primary: d.is_primary || false,
      }));

    return NextResponse.json({
      success: true,
      tenant_id: auth.tenantId,
      domains,
    });
  } catch (error) {
    console.error("Fetch tenant domains error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant domains" },
      { status: 500 }
    );
  }
}
