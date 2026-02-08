/**
 * Tenant Payment Configuration
 *
 * GET  /api/b2b/payments/config — Get tenant payment config
 * PUT  /api/b2b/payments/config — Update tenant payment config
 *
 * Manages per-tenant gateway credentials and payment settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { PAYMENT_PROVIDERS, PAYMENT_DEFAULTS } from "@/lib/constants/payment";

// ============================================
// GET — Retrieve config
// ============================================

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const config = await TenantPaymentConfig.findOne({
      tenant_id: auth.tenantId,
    }).lean();

    if (!config) {
      // Return default config shape (not yet configured)
      return NextResponse.json({
        success: true,
        config: {
          tenant_id: auth.tenantId,
          commission_rate: PAYMENT_DEFAULTS.COMMISSION_RATE,
          providers: {},
          default_provider: null,
          enabled_methods: [],
        },
        configured: false,
      });
    }

    return NextResponse.json({
      success: true,
      config,
      configured: true,
    });
  } catch (error) {
    console.error("Get payment config error:", error);
    return NextResponse.json(
      { error: "Failed to get payment configuration" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT — Update config
// ============================================

const ALLOWED_PROVIDERS = PAYMENT_PROVIDERS.map(String);

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const { providers, default_provider, enabled_methods } = body;

    // Validate default_provider if set
    if (default_provider && !ALLOWED_PROVIDERS.includes(default_provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${default_provider}. Allowed: ${ALLOWED_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const updateData: Record<string, unknown> = {};
    if (providers !== undefined) updateData.providers = providers;
    if (default_provider !== undefined) updateData.default_provider = default_provider;
    if (enabled_methods !== undefined) updateData.enabled_methods = enabled_methods;

    const config = await TenantPaymentConfig.findOneAndUpdate(
      { tenant_id: auth.tenantId },
      {
        $set: updateData,
        $setOnInsert: {
          tenant_id: auth.tenantId,
          commission_rate: PAYMENT_DEFAULTS.COMMISSION_RATE,
        },
      },
      { upsert: true, new: true, lean: true }
    );

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Update payment config error:", error);
    return NextResponse.json(
      { error: "Failed to update payment configuration" },
      { status: 500 }
    );
  }
}
