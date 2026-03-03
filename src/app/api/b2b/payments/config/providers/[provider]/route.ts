/**
 * Individual Provider Configuration
 *
 * GET  /api/b2b/payments/config/providers/[provider] — Get provider config
 * PUT  /api/b2b/payments/config/providers/[provider] — Update provider config
 *
 * Uses dot notation to update a single provider without overwriting others.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { PAYMENT_PROVIDERS, PAYMENT_DEFAULTS } from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";
import { getRequiredFields } from "@/lib/constants/provider-fields";

const VALID_PROVIDERS = new Set<string>(PAYMENT_PROVIDERS.filter((p) => p !== "manual"));

// ============================================
// GET — Retrieve single provider config
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { provider } = await params;

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const config = await TenantPaymentConfig.findOne({
      tenant_id: auth.tenantId,
    }).lean();

    const providerConfig = config?.providers?.[provider as keyof typeof config.providers] ?? null;

    return NextResponse.json({
      success: true,
      provider,
      config: providerConfig,
      configured: providerConfig !== null && providerConfig !== undefined,
    });
  } catch (error) {
    console.error("GET /api/b2b/payments/config/providers/[provider] error:", error);
    return NextResponse.json(
      { error: "Failed to get provider configuration" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT — Update single provider config
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { provider } = await params;

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Validate required fields
    const requiredFields = getRequiredFields(provider as PaymentProvider);
    for (const field of requiredFields) {
      const value = body[field];
      if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
        return NextResponse.json(
          { error: `Field "${field}" is required for provider ${provider}` },
          { status: 400 }
        );
      }
    }

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    // Use dot notation to update only this provider's config
    const config = await TenantPaymentConfig.findOneAndUpdate(
      { tenant_id: auth.tenantId },
      {
        $set: { [`providers.${provider}`]: body },
        $setOnInsert: {
          tenant_id: auth.tenantId,
          commission_rate: PAYMENT_DEFAULTS.COMMISSION_RATE,
        },
      },
      { upsert: true, new: true, lean: true }
    );

    const savedProviderConfig = config?.providers?.[provider as keyof typeof config.providers] ?? null;

    return NextResponse.json({
      success: true,
      provider,
      config: savedProviderConfig,
    });
  } catch (error) {
    console.error("PUT /api/b2b/payments/config/providers/[provider] error:", error);
    return NextResponse.json(
      { error: "Failed to update provider configuration" },
      { status: 500 }
    );
  }
}
