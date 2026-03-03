/**
 * Public Payment Completion
 *
 * POST /api/public/payments/complete
 *
 * Called by the /pay/complete page after PayPal redirects the customer back.
 * No authentication required — the PayPal order token is the proof.
 * Finds the transaction by provider_payment_id and captures it.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";
import { capturePayment } from "@/lib/payments/payment.service";
import { initializeProviders } from "@/lib/payments/providers/register-providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider_payment_id, tenant } = body;

    if (!provider_payment_id || !tenant) {
      return NextResponse.json(
        { error: "Missing required fields: provider_payment_id, tenant" },
        { status: 400 }
      );
    }

    // Validate tenant format (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/i.test(tenant)) {
      return NextResponse.json(
        { error: "Invalid tenant format" },
        { status: 400 }
      );
    }

    // Ensure providers are registered
    initializeProviders();

    const dbName = `vinc-${tenant}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const PaymentTransaction = registry.PaymentTransaction;

    // Find transaction by provider_payment_id (PayPal order ID)
    const transaction = await PaymentTransaction.findOne({
      provider_payment_id,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Already completed — return success
    if (transaction.status === "completed") {
      return NextResponse.json({
        success: true,
        transaction_id: transaction.transaction_id,
        status: "completed",
        already_captured: true,
      });
    }

    // Capture the payment (also updates the order via recordGatewayPayment)
    const result = await capturePayment(connection, transaction.transaction_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment capture failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction_id,
      status: result.status,
    });
  } catch (error) {
    console.error("Public payment complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete payment" },
      { status: 500 }
    );
  }
}
