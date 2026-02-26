/**
 * Get Payment Transaction Detail
 *
 * GET /api/b2b/payments/transactions/:id
 *
 * Returns full transaction detail including audit trail events.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection";
import { getModelRegistry } from "@/lib/db/model-registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id } = await params;

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const registry = getModelRegistry(connection);
    const PaymentTransaction = registry.PaymentTransaction;

    const transaction = await PaymentTransaction.findOne({
      transaction_id: id,
      tenant_id: auth.tenantId,
    }).lean();

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    return NextResponse.json(
      { error: "Failed to get transaction" },
      { status: 500 }
    );
  }
}
