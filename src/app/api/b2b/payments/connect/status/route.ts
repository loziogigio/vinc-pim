/**
 * Stripe Connect — Account Status
 *
 * GET /api/b2b/payments/connect/status
 *
 * Returns the current Connect account status for the authenticated tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { getAccountStatus } from "@/lib/payments/stripe-connect.service";

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

    const accountId = config?.providers?.stripe?.account_id;
    if (!accountId) {
      return NextResponse.json({
        success: true,
        data: { connected: false },
      });
    }

    // Fetch live status from Stripe
    const status = await getAccountStatus(accountId);

    // Derive account_status
    const accountStatus = status.charges_enabled
      ? "active"
      : status.requirements_pending > 0
        ? "restricted"
        : "pending";

    // Sync status back to our DB
    const updateFields: Record<string, unknown> = {
      "providers.stripe.charges_enabled": status.charges_enabled,
      "providers.stripe.payouts_enabled": status.payouts_enabled,
      "providers.stripe.details_submitted": status.details_submitted,
      "providers.stripe.account_status": accountStatus,
    };

    // Set onboarded_at when charges_enabled first becomes true
    if (status.charges_enabled && !config?.providers?.stripe?.onboarded_at) {
      updateFields["providers.stripe.onboarded_at"] = new Date();
    }

    await TenantPaymentConfig.updateOne(
      { tenant_id: auth.tenantId },
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        account_id: status.account_id,
        account_status: accountStatus,
        charges_enabled: status.charges_enabled,
        payouts_enabled: status.payouts_enabled,
        details_submitted: status.details_submitted,
        requirements_pending: status.requirements_pending,
        current_deadline: status.current_deadline,
        onboarded_at: config?.providers?.stripe?.onboarded_at,
      },
    });
  } catch (error) {
    console.error("GET /api/b2b/payments/connect/status error:", error);
    return NextResponse.json(
      { error: "Failed to check Connect status" },
      { status: 500 }
    );
  }
}
