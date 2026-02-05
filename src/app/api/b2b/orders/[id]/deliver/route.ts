/**
 * POST /api/b2b/orders/[id]/deliver
 *
 * Mark an order as delivered.
 * Transitions: shipped → delivered
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { deliverOrder } from "@/lib/services/order-lifecycle.service";
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

    // Warehouse, admin, or system role
    const userRole: UserRole = auth.isAdmin ? "admin" : "warehouse";

    const result = await deliverOrder(
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
    });
  } catch (error) {
    console.error("Error delivering order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark order as delivered" },
      { status: 500 }
    );
  }
}
