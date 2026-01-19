/**
 * Rate Limit Settings API
 *
 * GET  /api/admin/tenants/[id]/rate-limit - Get rate limit settings
 * PATCH /api/admin/tenants/[id]/rate-limit - Update rate limit settings
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import { invalidateTenantRateLimitCache } from "@/lib/services/tenant-rate-limit.service";

const DEFAULT_RATE_LIMIT = {
  enabled: false,
  requests_per_minute: 0,
  requests_per_day: 0,
  max_concurrent: 0,
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

    // Validate input
    const {
      enabled,
      requests_per_minute = 0,
      requests_per_day = 0,
      max_concurrent = 0,
    } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    // Validate numeric fields
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
    ].filter(Boolean);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    const TenantModel = await getTenantModel();
    const tenant = await TenantModel.findOneAndUpdate(
      { tenant_id: id.toLowerCase() },
      {
        $set: {
          "settings.rate_limit": {
            enabled,
            requests_per_minute: enabled ? requests_per_minute : 0,
            requests_per_day: enabled ? requests_per_day : 0,
            max_concurrent: enabled ? max_concurrent : 0,
          },
        },
      },
      { new: true }
    );

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Invalidate cache so new settings take effect immediately
    await invalidateTenantRateLimitCache(id);

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
