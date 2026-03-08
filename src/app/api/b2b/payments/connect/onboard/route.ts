/**
 * Stripe Connect — Start Onboarding
 *
 * POST /api/b2b/payments/connect/onboard
 *
 * Creates a Stripe Express account for the tenant (if not already created)
 * and returns a Stripe-hosted onboarding URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { PAYMENT_DEFAULTS } from "@/lib/constants/payment";
import {
  createExpressAccount,
  createAccountLink,
} from "@/lib/payments/stripe-connect.service";
import { getStripeConnectMappingModel } from "@/lib/db/models/stripe-connect-mapping";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { email, country, business_name } = body as {
      email?: string;
      country?: string;
      business_name?: string;
    };

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    // Check if tenant already has a Connect account
    const existing = await TenantPaymentConfig.findOne({
      tenant_id: auth.tenantId,
    }).lean();

    const stripeConfig = existing?.providers?.stripe;

    if (stripeConfig?.account_id && stripeConfig.account_status === "active") {
      return NextResponse.json({
        success: true,
        data: {
          account_id: stripeConfig.account_id,
          account_status: "active",
          charges_enabled: stripeConfig.charges_enabled,
          payouts_enabled: stripeConfig.payouts_enabled,
          already_onboarded: true,
        },
      });
    }

    // Build return/refresh URLs
    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const returnUrl = `${origin}/b2b/payments/gateways/stripe?connect=return`;
    const refreshUrl = `${origin}/b2b/payments/gateways/stripe?connect=refresh`;

    let accountId = stripeConfig?.account_id;

    // Create Express account if none exists
    if (!accountId) {
      const account = await createExpressAccount(auth.tenantId, {
        email,
        country,
        business_name,
      });
      accountId = account.id;

      // Store mapping in admin DB for webhook lookups
      const MappingModel = await getStripeConnectMappingModel();
      await MappingModel.findOneAndUpdate(
        { account_id: accountId },
        { account_id: accountId, tenant_id: auth.tenantId },
        { upsert: true }
      );

      // Update tenant's Stripe config with account_id
      await TenantPaymentConfig.findOneAndUpdate(
        { tenant_id: auth.tenantId },
        {
          $set: {
            "providers.stripe.account_id": accountId,
            "providers.stripe.account_status": "pending",
            "providers.stripe.charges_enabled": false,
            "providers.stripe.payouts_enabled": false,
            "providers.stripe.details_submitted": false,
            "providers.stripe.environment":
              stripeConfig?.environment || "test",
          },
          $setOnInsert: {
            tenant_id: auth.tenantId,
            commission_rate: PAYMENT_DEFAULTS.COMMISSION_RATE,
          },
        },
        { upsert: true }
      );
    }

    // Generate onboarding link
    const onboardingUrl = await createAccountLink(
      accountId,
      returnUrl,
      refreshUrl
    );

    return NextResponse.json({
      success: true,
      data: {
        onboarding_url: onboardingUrl,
        account_id: accountId,
      },
    });
  } catch (error) {
    console.error("POST /api/b2b/payments/connect/onboard error:", error);
    return NextResponse.json(
      { error: "Failed to start Stripe Connect onboarding" },
      { status: 500 }
    );
  }
}
