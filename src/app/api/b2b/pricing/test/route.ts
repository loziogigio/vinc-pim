/**
 * POST /api/b2b/pricing/test
 *
 * Admin endpoint to test a pricing provider connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { initializePricingProviders } from "@/lib/pricing/providers/register-providers";
import { getPricingProvider } from "@/lib/pricing/providers/provider-registry";
import { getCircuitState } from "@/lib/pricing/circuit-breaker";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const providerName = body.provider;

    // Initialize providers
    initializePricingProviders();

    // If no provider specified, use the tenant's active provider
    const { TenantPricingConfig } = await connectWithModels(tenantDb);
    const tenantConfig = await TenantPricingConfig.findOne({
      tenant_id: tenantId,
    }).lean();

    const targetProvider = providerName || tenantConfig?.active_provider;

    if (!targetProvider) {
      return NextResponse.json(
        { error: "No provider specified and no active provider configured" },
        { status: 400 }
      );
    }

    const provider = getPricingProvider(targetProvider);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${targetProvider}` },
        { status: 400 }
      );
    }

    // Get provider-specific config
    const providerConfig =
      tenantConfig?.providers?.[
        targetProvider as keyof typeof tenantConfig.providers
      ];

    if (!providerConfig) {
      return NextResponse.json(
        {
          error: `Provider "${targetProvider}" is not configured for this tenant`,
        },
        { status: 400 }
      );
    }

    // Test the connection
    const testResult = await provider.testConnection(providerConfig);

    // Include circuit breaker state
    const circuitState = getCircuitState(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        provider: targetProvider,
        ...testResult,
        circuit_breaker: {
          status: circuitState.status,
          failure_count: circuitState.failure_count,
        },
      },
    });
  } catch (err: any) {
    console.error("[POST /api/b2b/pricing/test] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
