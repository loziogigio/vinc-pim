/**
 * POST /api/b2b/orders/[id]/duplicate
 *
 * Duplicate an order as a new draft cart.
 * Useful for reordering or creating similar orders.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { duplicateOrder } from "@/lib/services/order-lifecycle.service";

interface RequestBody {
  include_discounts?: boolean;
  reset_quantities?: boolean;
  clear_notes?: boolean;
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

    const result = await duplicateOrder(
      connection,
      orderId,
      auth.userId || "anonymous",
      {
        includeDiscounts: body.include_discounts ?? false,
        resetQuantities: body.reset_quantities ?? false,
        clearNotes: body.clear_notes ?? true,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      source_order_id: orderId,
    });
  } catch (error) {
    console.error("Error duplicating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to duplicate order" },
      { status: 500 }
    );
  }
}
