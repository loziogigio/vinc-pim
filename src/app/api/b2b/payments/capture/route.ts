/**
 * Capture Payment
 *
 * POST /api/b2b/payments/capture
 *
 * Captures a previously created payment after provider approval (e.g. PayPal redirect).
 * Updates the transaction from "processing" → "completed".
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { capturePayment } from "@/lib/payments/payment.service";
import { initializeProviders } from "@/lib/payments/providers/register-providers";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const { transaction_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "Missing required field: transaction_id" },
        { status: 400 }
      );
    }

    // Ensure providers are registered
    initializeProviders();

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await capturePayment(connection, transaction_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment capture failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction_id,
      provider_payment_id: result.provider_payment_id,
      status: result.status,
    });
  } catch (error) {
    console.error("Capture payment error:", error);
    return NextResponse.json(
      { error: "Failed to capture payment" },
      { status: 500 }
    );
  }
}
