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
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import type { UserRole } from "@/lib/constants/order";
import { buildHookCtxFromOrder, runOnMergeAfter, windmillResponseFragment } from "@/lib/services/windmill-proxy.service";

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

    // ── HOOKS: on (cancel in ERP) + after (fire-and-forget) ──
    const hookCtx = buildHookCtxFromOrder(dbName, auth.tenantId, "order.cancel", result.order, {
      requestData: body as Record<string, unknown>,
    });
    const on = await runOnMergeAfter(hookCtx, connection.model("Order"), (result.order as any)?._id);

    void dispatchTrigger(dbName, "order_cancelled", { type: "order", order: result.order! });

    return NextResponse.json({
      success: true,
      order: result.order,
      ...windmillResponseFragment(hookCtx.channel, null, on),
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 }
    );
  }
}
