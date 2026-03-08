/**
 * Admin — Tenant Commission Management
 *
 * GET    /api/admin/payments/tenants/[tenantId]/commission — Get commission config
 * PUT    /api/admin/payments/tenants/[tenantId]/commission — Set generic and/or per-provider rates
 * DELETE /api/admin/payments/tenants/[tenantId]/commission?provider=stripe — Remove a provider override
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { PAYMENT_PROVIDERS, PAYMENT_DEFAULTS } from "@/lib/constants/payment";

const VALID_PROVIDERS = new Set<string>(PAYMENT_PROVIDERS);

function isValidRate(rate: unknown): rate is number {
  return typeof rate === "number" && rate >= 0 && rate <= 1;
}

// ============================================
// GET — Read commission config
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { tenantId } = await params;
    const dbName = `vinc-${tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const config = await TenantPaymentConfig.findOne({ tenant_id: tenantId })
      .select("commission_rate provider_commission_rates")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        tenant_id: tenantId,
        commission_rate: config?.commission_rate ?? PAYMENT_DEFAULTS.COMMISSION_RATE,
        provider_commission_rates: config?.provider_commission_rates ?? {},
      },
    });
  } catch (error) {
    console.error("GET admin commission error:", error);
    return NextResponse.json(
      { error: "Failed to get commission config" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT — Update commission rates
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { tenantId } = await params;
    const body = await req.json();
    const { commission_rate, provider_commission_rates } = body as {
      commission_rate?: number;
      provider_commission_rates?: Record<string, number>;
    };

    // Validate generic rate
    if (commission_rate !== undefined && !isValidRate(commission_rate)) {
      return NextResponse.json(
        { error: "commission_rate must be a number between 0 and 1 (e.g. 0.025 for 2.5%)" },
        { status: 400 }
      );
    }

    // Validate per-provider rates
    if (provider_commission_rates) {
      for (const [provider, rate] of Object.entries(provider_commission_rates)) {
        if (!VALID_PROVIDERS.has(provider)) {
          return NextResponse.json(
            { error: `Invalid provider: ${provider}` },
            { status: 400 }
          );
        }
        if (!isValidRate(rate)) {
          return NextResponse.json(
            { error: `Rate for ${provider} must be a number between 0 and 1` },
            { status: 400 }
          );
        }
      }
    }

    // Nothing to update
    if (commission_rate === undefined && !provider_commission_rates) {
      return NextResponse.json(
        { error: "Provide commission_rate and/or provider_commission_rates" },
        { status: 400 }
      );
    }

    const dbName = `vinc-${tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const updateFields: Record<string, unknown> = {};

    if (commission_rate !== undefined) {
      updateFields.commission_rate = commission_rate;
    }

    if (provider_commission_rates) {
      for (const [provider, rate] of Object.entries(provider_commission_rates)) {
        updateFields[`provider_commission_rates.${provider}`] = rate;
      }
    }

    const config = await TenantPaymentConfig.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        $set: updateFields,
        $setOnInsert: {
          tenant_id: tenantId,
          ...(commission_rate === undefined && {
            commission_rate: PAYMENT_DEFAULTS.COMMISSION_RATE,
          }),
        },
      },
      { upsert: true, new: true, lean: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        tenant_id: tenantId,
        commission_rate: config.commission_rate,
        provider_commission_rates: config.provider_commission_rates ?? {},
      },
    });
  } catch (error) {
    console.error("PUT admin commission error:", error);
    return NextResponse.json(
      { error: "Failed to update commission config" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE — Remove a provider-specific override
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { tenantId } = await params;
    const provider = req.nextUrl.searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Query parameter 'provider' is required" },
        { status: 400 }
      );
    }

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const dbName = `vinc-${tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const config = await TenantPaymentConfig.findOneAndUpdate(
      { tenant_id: tenantId },
      { $unset: { [`provider_commission_rates.${provider}`]: "" } },
      { new: true, lean: true }
    );

    if (!config) {
      return NextResponse.json(
        { error: "Tenant payment config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tenant_id: tenantId,
        commission_rate: config.commission_rate,
        provider_commission_rates: config.provider_commission_rates ?? {},
      },
    });
  } catch (error) {
    console.error("DELETE admin commission error:", error);
    return NextResponse.json(
      { error: "Failed to remove provider commission override" },
      { status: 500 }
    );
  }
}
