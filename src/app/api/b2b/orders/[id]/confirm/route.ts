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
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import type { UserRole } from "@/lib/constants/order";
import { buildHookCtx, runBeforeHook, updateCtxFromOrder, runOnMergeAfter, windmillResponseFragment } from "@/lib/services/windmill-proxy.service";

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

    // ── BEFORE HOOK: validate with ERP (credit check, stock) ──
    const hookCtx = buildHookCtx(dbName, auth.tenantId, "order.confirm", { orderId });
    const before = await runBeforeHook(hookCtx);
    if (before.hooked && !before.allowed) {
      return NextResponse.json(
        { error: before.message || "Operation rejected by ERP", windmill: { phase: "before", blocked: true } },
        { status: 422 },
      );
    }

    const result = await confirmOrder(connection, orderId, auth.userId || "system", userRole);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // ── ON + AFTER HOOKS ──
    updateCtxFromOrder(hookCtx, result.order);
    const on = await runOnMergeAfter(hookCtx, connection.model("Order"), (result.order as any)?._id);

    void dispatchTrigger(dbName, "order_confirmation", {
      type: "order", order: result.order!, portalUserId: auth.userId || undefined,
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      order_number: result.order?.order_number,
      ...windmillResponseFragment(hookCtx.channel, before, on),
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm order" },
      { status: 500 }
    );
  }
}
