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
import { claimableSubmitLockFilter, isSubmitLockActive } from "@/lib/utils/submit-lock";
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
  // Filter on `status: "draft"` so a racing/blocked before-hook can never
  // revert an order that already transitioned past draft via a successful
  // concurrent submit (see IR6uhtIVQE-B 2026-04-21). The atomic claim at
  // the top of POST sets status=draft, so legitimate failure paths still
  // match.
  await Order.updateOne(
    { order_id: orderId, status: "draft" },
    {
      $set: {
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

  // Atomically claim the row: transition `processing_status: "failed"` +
  // `submitting != true` → `submitting: true` and reset the submission-state
  // fields in a single operation. This replaces the previous non-atomic
  // `findOne + save` which allowed a second click to run concurrently and
  // pollute Mongo with a failed-retry merge on top of a successful submit.
  let submitClaimed = false;

  try {
    const order = await Order.findOneAndUpdate(
      {
        order_id: orderId,
        processing_status: "failed",
        ...claimableSubmitLockFilter(),
      },
      {
        $set: {
          submitting: true,
          submitting_at: new Date(),
          status: "draft",
          is_current: false, // Not editing — just resubmitting with autofix
        },
        $unset: {
          processing_status: "",
          processing_job_id: "",
          processing_started_at: "",
          processing_completed_at: "",
          processing_errors: "",
          erp_sync_status: "",
          submitted_at: "",
          confirmed_at: "",
          order_number: "",
        },
      },
      { new: true },
    );

    if (!order) {
      const exists = await Order.findOne({ order_id: orderId })
        .select("processing_status submitting submitting_at")
        .lean();
      if (!exists) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (isSubmitLockActive(exists)) {
        return NextResponse.json(
          { error: "Order is already being resubmitted" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: `Can only resubmit failed orders. Current processing_status: "${exists.processing_status || "none"}"`,
          code: "ORDER_NOT_RESUBMITTABLE",
          processing_status: exists.processing_status || null,
        },
        { status: 400 },
      );
    }
    submitClaimed = true;

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
      // must survive so the next attempt reuses the same ERP cart/rows.
      // Defense in depth: strip erp_status from a blocked before-hook's
      // payload so it can't clobber the on-hook's authoritative "submitted"
      // value if a concurrent before-hook races a successful submit.
      if (before.modified_data) {
        const erpData = before.modified_data.erp_data as Record<string, unknown> | undefined;
        if (erpData && "erp_status" in erpData) {
          delete erpData.erp_status;
        }
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
  } finally {
    // Release the submitting lock on every exit path — success, early return,
    // async-fallback, or thrown error. Idempotent with the explicit clears
    // inside restoreFailedState / async $set blocks above.
    if (submitClaimed) {
      await Order.updateOne(
        { order_id: orderId },
        { $set: { submitting: false }, $unset: { submitting_at: "" } },
      ).catch(() => {});
    }
  }
}
