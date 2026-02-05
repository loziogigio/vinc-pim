/**
 * POST /api/b2b/orders/[id]/cancel
 *
 * Cancel an order.
 * Available from most statuses with role restrictions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { cancelOrder } from "@/lib/services/order-lifecycle.service";
import type { UserRole } from "@/lib/constants/order";

interface RequestBody {
  reason?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const body: RequestBody = await req.json().catch(() => ({}));

    // Determine role based on auth context
    const userRole: UserRole = auth.isAdmin ? "admin" : "sales";

    const result = await cancelOrder(
      connection,
      orderId,
      auth.userId || "system",
      userRole,
      body.reason
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 }
    );
  }
}
