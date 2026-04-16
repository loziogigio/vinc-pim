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
import { getPooledConnection, connectWithModels } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { isDeferredPaymentMethod } from "@/lib/constants/payment";
import {
  buildHookCtxFromOrder,
  updateCtxFromOrder,
  runBeforeHookWithAsyncFallback,
  runOnHookAuto,
  mergeOrderErpData,
  pushWindmillJobRef,
} from "@/lib/services/windmill-proxy.service";

/**
 * Restore the order to the `processing_status: "failed"` state so the user
 * can click resubmit again after a failed retry. Called on any failure path
 * after the pre-hook reset wiped the previous state.
 */
async function restoreFailedState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Order: any,
  orderId: string,
  errors: string[],
): Promise<void> {
  await Order.updateOne(
    { order_id: orderId },
    {
      $set: {
        status: "draft",
        processing_status: "failed",
        processing_completed_at: new Date(),
        processing_errors: errors,
        submitting: false,
      },
      $unset: { processing_phase: "", processing_job_id: "" },
    },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const dbName = `vinc-${auth.tenantId}`;
  const connection = await getPooledConnection(dbName);
  const { Order } = await connectWithModels(dbName);

  try {

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

    const before = await runBeforeHookWithAsyncFallback(hookCtx);

    // Async fallback — ERP is slow; return 202 and let the client poll
    // processing-status. Mirrors submit route behaviour.
    if (before.async && before.jobId) {
      await Order.updateOne(
        { order_id: orderId },
        {
          $set: {
            processing_job_id: before.jobId,
            processing_status: "processing",
            processing_phase: "before",
            processing_started_at: new Date(),
            is_current: false,
            submitting: false,
          },
        },
      );
      await pushWindmillJobRef(Order, orderId, {
        job_id: before.jobId, script: "before_order_submit", phase: "before", operation: "order.submit",
        status: "queued", mode: "async",
      });
      return NextResponse.json(
        {
          success: true,
          order_id: orderId,
          processing: true,
          processing_phase: "before",
          message: "ERP validation in progress",
        },
        { status: 202 },
      );
    }

    if (before.hooked && !before.allowed) {
      // Persist ERP data even on rejection — erp_cart_id and erp_line_numbers
      // must survive so the next attempt reuses the same ERP cart/rows
      if (before.modified_data) {
        await mergeOrderErpData(Order, (order as any)._id, { success: true, data: before.modified_data });
      }
      // Restore failed state so the user can click resubmit again
      await restoreFailedState(Order, orderId, [before.message || "Operation rejected by ERP"]);
      return NextResponse.json(
        {
          error: before.message || "Operation rejected by ERP",
          windmill: { phase: "before", blocked: true, modified_data: before.modified_data },
        },
        { status: 422 },
      );
    }

    // ── SUBMIT ORDER: draft → pending/confirmed ──
    const result = await submitOrder(connection, orderId, auth.userId || "anonymous");
    if (!result.success) {
      await restoreFailedState(Order, orderId, [result.error || "submitOrder failed"]);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    updateCtxFromOrder(hookCtx, result.order);

    // ── ON HOOK: ERP export with async fallback (autofix in requestData) ──
    const on = await runOnHookAuto(hookCtx);

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

    return NextResponse.json({
      success: true,
      order: result.order,
      order_number: result.order?.order_number,
      sync: true,
    });
  } catch (error) {
    console.error("Error resubmitting order:", error);
    // Rollback so the order isn't wedged with processing_status: undefined —
    // user can click resubmit again from the failed state.
    await restoreFailedState(Order, orderId, [
      error instanceof Error ? error.message : "Failed to resubmit order",
    ]).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resubmit order" },
      { status: 500 },
    );
  }
}
