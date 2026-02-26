/**
 * Create OnClick Payment
 *
 * POST /api/b2b/payments/create
 *
 * Creates a standard e-commerce payment (3DS required).
 * Returns redirect URL or client secret for frontend completion.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { processPayment } from "@/lib/payments/payment.service";
import { initializeProviders } from "@/lib/payments/providers/register-providers";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const {
      order_id,
      amount,
      currency = "EUR",
      provider,
      method,
      customer_id,
      customer_email,
      return_url,
      idempotency_key,
    } = body;

    // Validate required fields
    if (!order_id || !amount || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: order_id, amount, provider" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Ensure providers are registered
    initializeProviders();

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await processPayment(
      connection,
      {
        tenantId: auth.tenantId,
        providerName: provider,
        paymentType: "onclick",
      },
      {
        order_id,
        amount,
        currency,
        method,
        customer_id,
        customer_email,
        return_url,
        idempotency_key,
        metadata: body.metadata,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment creation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id: result.transaction_id,
      provider_payment_id: result.provider_payment_id,
      redirect_url: result.redirect_url,
      client_secret: result.client_secret,
      status: result.status,
    });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
