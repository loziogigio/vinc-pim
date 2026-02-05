/**
 * POST /api/b2b/orders/[id]/confirm
 *
 * Confirm an order (pending or accepted quotation → confirmed).
 * Creates a Sales Order that cannot be modified.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { confirmOrder } from "@/lib/services/order-lifecycle.service";
import type { UserRole } from "@/lib/constants/order";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    // Determine user role from auth context
    const userRole: UserRole = auth.isAdmin ? "admin" : "sales";

    const result = await confirmOrder(
      connection,
      orderId,
      auth.userId || "system",
      userRole
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      order_number: result.order?.order_number,
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm order" },
      { status: 500 }
    );
  }
}
