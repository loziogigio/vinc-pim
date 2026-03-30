/**
 * GET /api/b2b/orders/[id]/processing-status
 *
 * Poll the async ERP processing status for an order.
 *
 * - If no processing_job_id → returns { processing: false }
 * - If processing → checks Windmill job, finalizes if completed
 * - If already completed/failed → returns cached result (no Windmill call)
 * - Stale jobs (> 30 min) are auto-failed
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getPooledConnection } from "@/lib/db/connection";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { windmillGetJobResult } from "@/lib/services/windmill-client";
import { getProxySettings, mergeOrderErpData, runOnHookWithAsyncFallback, runAfterHook, pushWindmillJobRef } from "@/lib/services/windmill-proxy.service";
import { submitOrder } from "@/lib/services/order-lifecycle.service";
import { dispatchTrigger } from "@/lib/notifications/trigger-dispatch";
import { isDeferredPaymentMethod } from "@/lib/constants/payment";
import type { OnHookResponse, BeforeHookResponse, HookContext } from "@/lib/types/windmill-proxy";
import type { IOrder } from "@/lib/db/models/order";

const STALE_JOB_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const dbName = `vinc-${auth.tenantId}`;
    const { Order } = await connectWithModels(dbName);

    const order = await Order.findOne(
      { order_id: orderId },
      "order_id status processing_job_id processing_status processing_phase processing_started_at processing_completed_at processing_errors erp_sync_status order_number",
    ).lean<IOrder>();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // No processing job — return order status directly
    if (!order.processing_job_id || !order.processing_status) {
      return NextResponse.json({
        processing: false,
        status: order.status,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    }

    // Already finalized — return cached result
    if (order.processing_status === "completed" || order.processing_status === "failed") {
      return NextResponse.json({
        processing: false,
        processing_status: order.processing_status,
        processing_completed_at: order.processing_completed_at,
        processing_errors: order.processing_errors,
        erp_sync_status: order.erp_sync_status,
        status: order.status,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    }

    // Still processing — check for stale job
    const startedAt = order.processing_started_at ? new Date(order.processing_started_at).getTime() : 0;
    if (startedAt && Date.now() - startedAt > STALE_JOB_TIMEOUT_MS) {
      // Auto-fail stale job
      const updated = await Order.findOneAndUpdate(
        { order_id: orderId, processing_status: "processing" },
        {
          $set: {
            processing_status: "failed",
            processing_completed_at: new Date(),
            processing_errors: ["ERP processing timed out (exceeded 30 minutes)"],
            erp_sync_status: "failed",
          },
        },
        { new: true },
      ).lean<IOrder>();

      return NextResponse.json({
        processing: false,
        processing_status: "failed",
        processing_completed_at: updated?.processing_completed_at,
        processing_errors: ["ERP processing timed out (exceeded 30 minutes)"],
        erp_sync_status: "failed",
        status: updated?.status || order.status,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    }

    // Check Windmill job status
    const settings = await getProxySettings(dbName);
    const ws = settings?.workspace_name || process.env.WINDMILL_WORKSPACE || "";

    const jobResult = await windmillGetJobResult<OnHookResponse>(
      ws,
      order.processing_job_id,
    );

    if (!jobResult.completed) {
      // Still running
      return NextResponse.json({
        processing: true,
        processing_status: "processing",
        processing_phase: order.processing_phase,
        started_at: order.processing_started_at,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    }

    const phase = order.processing_phase || "on";

    // ── BEFORE phase async completion ──
    if (phase === "before") {
      const result = jobResult.result as unknown as BeforeHookResponse | undefined;
      console.log("[processing-status] before phase result:", JSON.stringify(result, null, 2)?.slice(0, 500));
      const allowed = result?.allowed !== false;

      if (allowed) {
        // ERP validation passed — merge before-hook data, then auto-submit (on-hook)
        if (result?.modified_data) {
          await mergeOrderErpData(Order, (order as any)._id, {
            success: true,
            data: result.modified_data,
          });
        }

        // Auto-submit: run submitOrder + on-hook server-side
        try {
          const connection = await getPooledConnection(dbName);
          const submitResult = await submitOrder(connection, orderId, auth.userId || "anonymous");

          if (!submitResult.success) {
            // Submit failed — mark as failed, let user retry
            await Order.updateOne(
              { order_id: orderId },
              { $set: { processing_status: "failed", processing_errors: [submitResult.error], submitting: false },
                $unset: { processing_phase: "", processing_job_id: "" } },
            );
            return NextResponse.json({
              processing: false, processing_status: "failed",
              processing_errors: [submitResult.error],
              order_id: order.order_id,
            });
          }

          // Run on-hook (ERP export: SetCarrelloInoltrabile + MySQL move)
          const refreshedOrder = await Order.findOne({ order_id: orderId });
          const hookCtx: HookContext = {
            tenantDb: dbName,
            tenantId: auth.tenantId,
            channel: (refreshedOrder as any)?.channel || "default",
            operation: "order.submit",
            orderId,
            customerCode: (refreshedOrder as any)?.customer_code,
            addressCode: (refreshedOrder as any)?.shipping_address_code,
            order: refreshedOrder ? refreshedOrder.toObject() : {},
          };

          const on = await runOnHookWithAsyncFallback(hookCtx);

          if (on.hooked && on.async && on.jobId) {
            // On-hook went async — keep processing
            await Order.updateOne(
              { order_id: orderId },
              { $set: { processing_job_id: on.jobId, processing_status: "processing", processing_phase: "on", submitting: false } },
            );
            await pushWindmillJobRef(Order, orderId, {
              job_id: on.jobId, script: "on_order_submit", phase: "on", operation: "order.submit",
            });
            return NextResponse.json({
              processing: true, processing_status: "processing", processing_phase: "on",
              order_id: order.order_id,
            });
          }

          if (on.hooked && on.success && on.response?.data) {
            await mergeOrderErpData(Order, (refreshedOrder as any)?._id, on.response);
          }

          // Fully completed — clear processing state
          await Order.updateOne(
            { order_id: orderId },
            { $set: { processing_status: "completed", processing_completed_at: new Date(), erp_sync_status: "synced", submitting: false },
              $unset: { processing_phase: "", processing_job_id: "" } },
          );

          runAfterHook(hookCtx);

          // Dispatch notification
          const paymentMethod = submitResult.order?.payment?.payment_method;
          if (isDeferredPaymentMethod(paymentMethod)) {
            void dispatchTrigger(dbName, "order_confirmation", {
              type: "order", order: submitResult.order!, portalUserId: auth.userId || undefined,
            });
          }

          return NextResponse.json({
            processing: false, processing_status: "completed",
            erp_sync_status: "synced",
            status: submitResult.order?.status || "pending",
            order_id: order.order_id, order_number: submitResult.order?.order_number,
          });
        } catch (err) {
          console.error("[processing-status] auto-submit failed:", err);
          await Order.updateOne(
            { order_id: orderId },
            { $set: { processing_status: "failed", processing_errors: [(err as Error).message], submitting: false },
              $unset: { processing_phase: "", processing_job_id: "" } },
          );
          return NextResponse.json({
            processing: false, processing_status: "failed",
            processing_errors: [(err as Error).message],
            order_id: order.order_id,
          });
        }
      } else {
        // ERP rejected — merge data (anomalies, erp_cart_id, etc.) and mark failed
        if (result?.modified_data) {
          await mergeOrderErpData(Order, (order as any)._id, {
            success: true,
            data: result.modified_data,
          });
        }

        const errors = [result?.message || "ERP validation rejected"];

        await Order.findOneAndUpdate(
          { order_id: orderId, processing_status: "processing" },
          {
            $set: {
              processing_status: "failed",
              processing_completed_at: new Date(),
              processing_errors: errors,
              is_current: false,
              submitting: false,
            },
            $unset: {
              processing_phase: "",
              processing_job_id: "",
            },
          },
        );

        return NextResponse.json({
          processing: false,
          processing_status: "failed",
          processing_phase: "before",
          processing_errors: errors,
          status: "draft",
          order_id: order.order_id,
        });
      }
    }

    // ── ON phase async completion (existing logic) ──
    const result = jobResult.result;
    const jobSuccess = result?.success !== false;

    if (jobSuccess) {
      const updated = await Order.findOneAndUpdate(
        { order_id: orderId, processing_status: "processing" },
        {
          $set: {
            processing_status: "completed",
            processing_completed_at: new Date(),
            erp_sync_status: "synced",
          },
        },
        { new: true },
      );

      if (updated && result?.data) {
        await mergeOrderErpData(Order, (updated as any)._id, result);
      }

      if (updated) {
        void dispatchTrigger(dbName, "order_confirmation", {
          type: "order",
          order: updated,
          portalUserId: auth.userId || undefined,
        });
      }

      return NextResponse.json({
        processing: false,
        processing_status: "completed",
        processing_completed_at: new Date(),
        erp_sync_status: "synced",
        status: (updated as any)?.status || order.status,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    } else {
      const errors = [result?.error || result?.message || "ERP processing failed"];

      const updated = await Order.findOneAndUpdate(
        { order_id: orderId, processing_status: "processing" },
        {
          $set: {
            processing_status: "failed",
            processing_completed_at: new Date(),
            processing_errors: errors,
            erp_sync_status: "failed",
          },
        },
        { new: true },
      );

      return NextResponse.json({
        processing: false,
        processing_status: "failed",
        processing_completed_at: new Date(),
        processing_errors: errors,
        erp_sync_status: "failed",
        status: (updated as any)?.status || order.status,
        order_id: order.order_id,
        order_number: order.order_number,
      });
    }
  } catch (error) {
    console.error("Error checking processing status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check processing status" },
      { status: 500 },
    );
  }
}
