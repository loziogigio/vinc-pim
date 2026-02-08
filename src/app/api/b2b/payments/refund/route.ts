/**
 * Refund Payment
 *
 * POST /api/b2b/payments/refund
 *
 * Refunds a transaction (full or partial).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { refundTransaction } from "@/lib/payments/payment.service";
import { initializeProviders } from "@/lib/payments/providers/register-providers";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const { transaction_id, amount } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "Missing required field: transaction_id" },
        { status: 400 }
      );
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    initializeProviders();

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await refundTransaction(connection, transaction_id, amount);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Refund failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      refund_id: result.refund_id,
      amount: result.amount,
    });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
}
