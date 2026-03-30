/**
 * POST /api/b2b/orders/[id]/submit
 *
 * Submit a draft order (cart) for processing.
 * Transitions: draft → pending (or auto-confirmed for deferred payments).
 *
 * Integrates with Windmill hooks (dynamically enabled per tenant):
 *   - before: validation (credit check, stock)
 *   - on: ERP export (sync-try / async-fallback at 10s)
 *   - after: fire-and-forget post-processing
 *
 * Returns 200 for sync completion, 202 for async processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPooledConnection, connectWithModels } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { isDeferredPaymentMethod } from "@/lib/constants/payment";
import { createOrderNoteSubmission } from "@/lib/services/order-note.service";
import {
  buildHookCtxFromOrder,
  updateCtxFromOrder,
  runBeforeHookWithAsyncFallback,
  runOnHookWithAsyncFallback,
  runAfterHook,
  mergeOrderErpData,
  pushWindmillJobRef,
} from "@/lib/services/windmill-proxy.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const dbName = `vinc-${auth.tenantId}`;
  const { Order } = await connectWithModels(dbName);

  try {
    const connection = await getPooledConnection(dbName);

    // Parse optional delivery details from body
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine — delivery details are optional
    }

    // Atomically claim the order for submission (prevents double-submit)
    const updateFields: Record<string, unknown> = {
      submitting: true,
    };
    if (body.delivery_date) {
      // Handle DD/MM/YYYY (from pickup) and YYYY-MM-DD (from datepicker)
      let dateStr = body.delivery_date as string;
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      updateFields.requested_delivery_date = new Date(dateStr);
    }
    if (body.delivery_type) {
      updateFields.shipping_method = body.delivery_type as string;
    }
    if (body.notes !== undefined) {
      updateFields.notes = body.notes as string;
    }
    if (body.pickup_data) {
      updateFields.pickup_data = body.pickup_data;
    }

    const order = await Order.findOneAndUpdate(
      { order_id: orderId, status: "draft", submitting: { $ne: true } },
      { $set: updateFields },
      { new: true },
    );
    if (!order) {
      // Either not found, not draft, or already being submitted
      const exists = await Order.findOne({ order_id: orderId }).select("status submitting").lean();
      if (!exists) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (exists.submitting) {
        return NextResponse.json({ error: "Order is already being submitted" }, { status: 409 });
      }
      return NextResponse.json(
        { error: `Order cannot be submitted (status: ${exists.status})` },
        { status: 400 },
      );
    }

    // ── BEFORE HOOK: validate with ERP (credit check, stock) ──
    const hookCtx = buildHookCtxFromOrder(dbName, auth.tenantId, "order.submit", order, {
      addressCode: order.shipping_address_code,
      requestData: body.autofix ? { autofix: true } : undefined,
    });

    const before = await runBeforeHookWithAsyncFallback(hookCtx);

    // Async fallback — order stays draft, client polls processing-status
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
      // Release the submitting lock so user can retry
      await Order.updateOne({ order_id: orderId }, { $set: { submitting: false } });
      return NextResponse.json(
        {
          error: before.message || "Operation rejected by ERP",
          windmill: { phase: "before", blocked: true, modified_data: before.modified_data },
        },
        { status: 422 },
      );
    }

    // Apply modified_data from before hook (e.g. erp_cart_id, erp_items)
    if (before.hooked && before.modified_data) {
      await mergeOrderErpData(Order, order._id, { success: true, data: before.modified_data });
      // Refresh order so submitOrder() and on-hook see the ERP data
      const refreshed = await Order.findOne({ order_id: orderId });
      if (refreshed) {
        hookCtx.order = refreshed.toObject();
      }
    }

    // ── SUBMIT ORDER: draft → pending/confirmed ──
    const result = await submitOrder(connection, orderId, auth.userId || "anonymous");
    if (!result.success) {
      await Order.updateOne({ order_id: orderId }, { $set: { submitting: false } });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Refresh hook context with updated order
    updateCtxFromOrder(hookCtx, result.order);

    // ── ON HOOK: ERP export with async fallback ──
    const on = await runOnHookWithAsyncFallback(hookCtx);

    if (on.hooked && on.async && on.jobId) {
      // Async path — ERP processing exceeded sync timeout
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
      await pushWindmillJobRef(Order, orderId, {
        job_id: on.jobId, script: "on_order_submit", phase: "on", operation: "order.submit",
      });

      void dispatchTrigger(dbName, "order_processing", {
        type: "order",
        order: result.order!,
        portalUserId: auth.userId || undefined,
      });

      // Fire-and-forget after hook
      runAfterHook(hookCtx);

      return NextResponse.json(
        {
          success: true,
          order_id: result.order?.order_id,
          order_number: result.order?.order_number,
          processing: true,
          message: "Order submitted — ERP processing in progress",
        },
        { status: 202 },
      );
    }

    if (on.hooked && on.success && on.response?.data) {
      // Sync path — ERP completed within timeout, merge data
      const OrderModel = connection.model("Order");
      await mergeOrderErpData(OrderModel, (result.order as any)?._id, on.response);
    }

    // Standard notification (same as before for tenants without hooks)
    const paymentMethod = result.order?.payment?.payment_method;
    if (isDeferredPaymentMethod(paymentMethod)) {
      void dispatchTrigger(dbName, "order_confirmation", {
        type: "order",
        order: result.order!,
        portalUserId: auth.userId || undefined,
      });

      if (result.order?.buyer && result.order.notes) {
        void createOrderNoteSubmission(dbName, result.order);
      }
    }

    // Fire-and-forget after hook
    runAfterHook(hookCtx);

    return NextResponse.json({
      success: true,
      order: result.order,
      order_number: result.order?.order_number,
      sync: true,
      ...(before.hooked || on.hooked
        ? {
            windmill: {
              channel: hookCtx.channel,
              before: before.hooked ? { allowed: before.allowed } : undefined,
              on: on.hooked ? { synced: on.success } : undefined,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("Error submitting order:", error);
    // Release submitting lock so the order can be retried
    await Order.updateOne({ order_id: orderId }, { $set: { submitting: false } }).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit order" },
      { status: 500 },
    );
  }
}
