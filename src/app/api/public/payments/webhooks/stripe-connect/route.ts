/**
 * Stripe Connect Platform Webhook
 *
 * POST /api/public/payments/webhooks/stripe-connect
 *
 * Platform-level webhook — no ?tenant parameter needed.
 * Handles account.updated events from Stripe Connect to sync
 * Express account status back to the tenant's payment config.
 *
 * Verification: STRIPE_CONNECT_WEBHOOK_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyConnectWebhook } from "@/lib/payments/stripe-connect.service";
import { getStripeConnectMappingModel } from "@/lib/db/models/stripe-connect-mapping";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) {
      console.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe-Signature header" },
        { status: 400 }
      );
    }

    // Verify signature
    let event;
    try {
      event = verifyConnectWebhook(payload, signature, secret);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    // Only handle account.updated events
    if (event.type !== "account.updated") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const account = event.data.object as {
      id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
      requirements?: {
        currently_due?: string[];
        current_deadline?: number | null;
      };
    };

    // Look up tenant from admin DB mapping
    const MappingModel = await getStripeConnectMappingModel();
    const mapping = await MappingModel.findOne({
      account_id: account.id,
    }).lean();

    if (!mapping) {
      console.warn(
        `Stripe Connect webhook: no tenant mapping for account ${account.id}`
      );
      return NextResponse.json({ received: true, skipped: true });
    }

    // Derive account_status
    const accountStatus = account.charges_enabled
      ? "active"
      : (account.requirements?.currently_due?.length ?? 0) > 0
        ? "restricted"
        : "pending";

    // Update tenant's Stripe config
    const dbName = `vinc-${mapping.tenant_id}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const TenantPaymentConfig = registry.TenantPaymentConfig;

    const updateFields: Record<string, unknown> = {
      "providers.stripe.charges_enabled": account.charges_enabled,
      "providers.stripe.payouts_enabled": account.payouts_enabled,
      "providers.stripe.details_submitted": account.details_submitted,
      "providers.stripe.account_status": accountStatus,
    };

    // Set onboarded_at on first charges_enabled
    if (account.charges_enabled) {
      const existing = await TenantPaymentConfig.findOne({
        tenant_id: mapping.tenant_id,
      }).lean();

      if (!existing?.providers?.stripe?.onboarded_at) {
        updateFields["providers.stripe.onboarded_at"] = new Date();
      }
    }

    await TenantPaymentConfig.updateOne(
      { tenant_id: mapping.tenant_id },
      { $set: updateFields }
    );

    console.log(
      `Stripe Connect: updated tenant ${mapping.tenant_id} → status=${accountStatus}, charges=${account.charges_enabled}`
    );

    return NextResponse.json({ received: true, event_id: event.id });
  } catch (error) {
    console.error("Stripe Connect webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
