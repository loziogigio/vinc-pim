/**
 * POST /api/b2b/orders/[id]/prepare
 *
 * Start preparing an order (confirmed → preparing).
 * Typically called by the ERP/Windmill `after_order_confirm` hook once the
 * order has been persisted downstream and is ready for warehouse picking.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { prepareOrder } from "@/lib/services/order-lifecycle.service";
import type { UserRole } from "@/lib/constants/order";
import {
  buildHookCtxFromOrder,
  runOnMergeAuto,
  windmillResponseFragment,
} from "@/lib/services/windmill-proxy.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);

    const userRole: UserRole = auth.isAdmin ? "admin" : "warehouse";

    const result = await prepareOrder(
      connection,
      orderId,
      auth.userId || "system",
      userRole
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const hookCtx = buildHookCtxFromOrder(
      dbName,
      auth.tenantId,
      "order.preparing",
      result.order
    );
    const on = await runOnMergeAuto(
      hookCtx,
      connection.model("Order"),
      (result.order as any)?._id,
      { orderId }
    );

    return NextResponse.json({
      success: true,
      order: result.order,
      ...windmillResponseFragment(hookCtx.channel, null, on),
    });
  } catch (error) {
    console.error("Error preparing order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to prepare order",
      },
      { status: 500 }
    );
  }
}
