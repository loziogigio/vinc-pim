/**
 * POST /api/b2b/orders/[id]/resubmit
 *
 * Submit with autofix — the user acknowledges the ERP anomalies and
 * authorises the ERP to fix them automatically (e.g. adjust prices,
 * correct quantities). The Windmill script receives `autofix: true`
 * in the hook payload so it knows to apply corrections instead of
 * rejecting the order again.
 *
 * Flow: reset to draft → submitOrder() → Windmill hooks (with autofix flag)
 * Same sync/async response pattern as the submit endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { isDeferredPaymentMethod } from "@/lib/constants/payment";
import {
  buildHookCtxFromOrder,
  updateCtxFromOrder,
  runBeforeHook,
  runOnHookWithAsyncFallback,
  runAfterHook,
  mergeOrderErpData,
} from "@/lib/services/windmill-proxy.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const dbName = `vinc-${auth.tenantId}`;
    const connection = await getPooledConnection(dbName);
    const Order = connection.model("Order");

    const order = await Order.findOne({ order_id: orderId });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow resubmit on failed processing orders
    if (order.processing_status !== "failed") {
      return NextResponse.json(
        { error: `Can only resubmit failed orders. Current processing_status: "${order.processing_status || "none"}"` },
        { status: 400 },
      );
    }

    // Reset to draft so submitOrder() can run again
    order.status = "draft";
    order.is_current = false; // Not editing — just resubmitting with autofix
    order.processing_status = undefined;
    order.processing_job_id = undefined;
    order.processing_started_at = undefined;
    order.processing_completed_at = undefined;
    order.processing_errors = undefined;
    order.erp_sync_status = undefined;
    order.submitted_at = undefined;
    order.confirmed_at = undefined;
    order.order_number = undefined;
    await order.save();

    // ── BEFORE HOOK: validate with ERP (autofix flag passed through) ──
    const hookCtx = buildHookCtxFromOrder(dbName, auth.tenantId, "order.submit", order, {
      addressCode: order.shipping_address_code,
      requestData: { autofix: true },
    });

    const before = await runBeforeHook(hookCtx);
    if (before.hooked && !before.allowed) {
      return NextResponse.json(
        {
          error: before.message || "Operation rejected by ERP",
          windmill: { phase: "before", blocked: true },
        },
        { status: 422 },
      );
    }

    // ── SUBMIT ORDER: draft → pending/confirmed ──
    const result = await submitOrder(connection, orderId, auth.userId || "anonymous");
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    updateCtxFromOrder(hookCtx, result.order);

    // ── ON HOOK: ERP export with async fallback (autofix in requestData) ──
    const on = await runOnHookWithAsyncFallback(hookCtx);

    if (on.hooked && on.async && on.jobId) {
      // Async path
      await Order.updateOne(
        { order_id: orderId },
        {
          $set: {
            processing_job_id: on.jobId,
            processing_status: "processing",
            processing_started_at: new Date(),
            erp_sync_status: "pending",
          },
        },
      );

      void dispatchTrigger(dbName, "order_processing", {
        type: "order",
        order: result.order!,
        portalUserId: auth.userId || undefined,
      });

      runAfterHook(hookCtx);

      return NextResponse.json(
        {
          success: true,
          order_id: result.order?.order_id,
          order_number: result.order?.order_number,
          processing: true,
          message: "Order resubmitted with autofix — ERP processing in progress",
        },
        { status: 202 },
      );
    }

    if (on.hooked && on.success && on.response?.data) {
      const OrderModel = connection.model("Order");
      await mergeOrderErpData(OrderModel, (result.order as any)?._id, on.response);
    }

    const paymentMethod = result.order?.payment?.payment_method;
    if (isDeferredPaymentMethod(paymentMethod)) {
      void dispatchTrigger(dbName, "order_confirmation", {
        type: "order",
        order: result.order!,
        portalUserId: auth.userId || undefined,
      });
    }

    runAfterHook(hookCtx);

    return NextResponse.json({
      success: true,
      order: result.order,
      order_number: result.order?.order_number,
      sync: true,
    });
  } catch (error) {
    console.error("Error resubmitting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resubmit order" },
      { status: 500 },
    );
  }
}
