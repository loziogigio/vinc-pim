/**
 * POST /api/b2b/orders/[id]/submit
 *
 * Submit a draft order (cart) for processing.
 * Transitions: draft → pending
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const result = await submitOrder(
      connection,
      orderId,
      auth.userId || "anonymous"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    void dispatchTrigger(dbName, "order_confirmation", {
      type: "order",
      order: result.order!,
      portalUserId: auth.userId || undefined,
    });

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("Error submitting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit order" },
      { status: 500 }
    );
  }
}
