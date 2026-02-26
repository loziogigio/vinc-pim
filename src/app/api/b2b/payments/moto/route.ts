/**
 * Create MOTO Payment
 *
 * POST /api/b2b/payments/moto
 *
 * Creates a MOTO payment (Mail Order / Telephone Order).
 * Card-not-present, 3DS exempt. Operator-initiated.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { processPayment } from "@/lib/payments/payment.service";
import { getProvider } from "@/lib/payments/providers/provider-registry";
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
      card_number,
      expiry_month,
      expiry_year,
      cvv,
      description,
      idempotency_key,
    } = body;

    // Validate required fields
    if (!order_id || !amount || !provider || !card_number || !expiry_month || !expiry_year) {
      return NextResponse.json(
        { error: "Missing required fields: order_id, amount, provider, card_number, expiry_month, expiry_year" },
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

    // Verify provider supports MOTO
    const providerImpl = getProvider(provider);
    if (!providerImpl?.supportsMoto) {
      return NextResponse.json(
        { error: `Provider ${provider} does not support MOTO payments` },
        { status: 400 }
      );
    }

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await processPayment(
      connection,
      {
        tenantId: auth.tenantId,
        providerName: provider,
        paymentType: "moto",
      },
      {
        order_id,
        amount,
        currency,
        idempotency_key,
        metadata: {
          description: description || `MOTO payment for ${order_id}`,
          payment_type: "moto",
        },
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "MOTO payment failed" },
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
    console.error("MOTO payment error:", error);
    return NextResponse.json(
      { error: "Failed to process MOTO payment" },
      { status: 500 }
    );
  }
}
