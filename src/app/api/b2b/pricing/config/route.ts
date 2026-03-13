/**
 * GET/PUT /api/b2b/pricing/config
 *
 * Admin endpoint to read/update tenant pricing provider configuration.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { invalidatePricingConfigCache } from "@/lib/pricing/pricing.service";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const { TenantPricingConfig } = await connectWithModels(tenantDb);
    const config = await TenantPricingConfig.findOne({
      tenant_id: tenantId,
    }).lean();

    return NextResponse.json({
      success: true,
      data: config || null,
    });
  } catch (err: any) {
    console.error("[GET /api/b2b/pricing/config] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();

    const { TenantPricingConfig } = await connectWithModels(tenantDb);

    const config = await TenantPricingConfig.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        $set: {
          tenant_id: tenantId,
          ...body,
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    // Invalidate cached config so next pricing call picks up changes
    invalidatePricingConfigCache(tenantId);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (err: any) {
    console.error("[PUT /api/b2b/pricing/config] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
