/**
 * Stripe Connect — Refresh Onboarding Link
 *
 * POST /api/b2b/payments/connect/refresh
 *
 * Generates a new Account Link if the previous one expired.
 * Stripe onboarding links expire after a few minutes.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { createAccountLink } from "@/lib/payments/stripe-connect.service";

export async function POST(req: NextRequest) {
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

    const accountId = config?.providers?.stripe?.account_id;
    if (!accountId) {
      return NextResponse.json(
        { error: "No Stripe Connect account found. Start onboarding first." },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const returnUrl = `${origin}/b2b/payments/gateways/stripe?connect=return`;
    const refreshUrl = `${origin}/b2b/payments/gateways/stripe?connect=refresh`;

    const onboardingUrl = await createAccountLink(
      accountId,
      returnUrl,
      refreshUrl
    );

    return NextResponse.json({
      success: true,
      data: { onboarding_url: onboardingUrl },
    });
  } catch (error) {
    console.error("POST /api/b2b/payments/connect/refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh onboarding link" },
      { status: 500 }
    );
  }
}
