/**
 * Stripe Connect — Express Dashboard Link
 *
 * POST /api/b2b/payments/connect/dashboard
 *
 * Generates a one-time login link to the Stripe Express dashboard
 * so the tenant can view their payouts, balance, and transactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { createLoginLink } from "@/lib/payments/stripe-connect.service";

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

    const stripeConfig = config?.providers?.stripe;
    if (!stripeConfig?.account_id) {
      return NextResponse.json(
        { error: "No Stripe Connect account found" },
        { status: 400 }
      );
    }

    if (!stripeConfig.details_submitted) {
      return NextResponse.json(
        { error: "Onboarding not completed. Please complete onboarding first." },
        { status: 400 }
      );
    }

    const dashboardUrl = await createLoginLink(stripeConfig.account_id);

    return NextResponse.json({
      success: true,
      data: { dashboard_url: dashboardUrl },
    });
  } catch (error) {
    console.error("POST /api/b2b/payments/connect/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard link" },
      { status: 500 }
    );
  }
}
