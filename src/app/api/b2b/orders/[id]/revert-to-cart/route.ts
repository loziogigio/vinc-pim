/**
 * POST /api/b2b/orders/[id]/revert-to-cart
 *
 * Re-enable a failed/processing order as the active editable cart.
 *
 * After submitOrder() the cart becomes: status=pending, is_current=false,
 * with processing_job_id + processing_status tracking the Windmill ERP job.
 * The ERP never acknowledged it as a real order — it's still essentially a cart
 * that was "sent off" and came back failed.
 *
 * This endpoint undoes submitOrder() by restoring: status=draft, is_current=true,
 * clearing submit/processing metadata. processing_errors are preserved so the UI
 * can highlight anomalous rows.
 *
 * If the user created a new active cart while this one was processing,
 * the existing active cart gets parked (same logic as cart/activate).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, tenantId } = auth;
    const { Order } = await connectWithModels(tenantDb);

    // Find the order to bring back as a cart
    const order = await Order.findOne({
      tenant_id: tenantId,
      order_id: orderId,
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only revert orders that were submitted but never fulfilled
    // Also allow draft orders that failed during processing (before-hook async failure)
    const revertableStatuses = ["draft", "pending", "confirmed"];
    if (!revertableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot revert order with status "${order.status}". Only draft/pending/confirmed orders can be reverted.` },
        { status: 400 },
      );
    }

    // Parse optional customer/address from body for scope filtering
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine — we'll use the order's own customer/address
    }

    const customerCode = (body.customer_code as string) || order.customer_code;
    const addressCode = (body.address_code as string) || order.shipping_address_code;

    // Park the current active cart (if any) — user may have started a new one
    // while this order was processing. Same logic as cart/activate.
    const scopeFilter: Record<string, unknown> = {
      tenant_id: tenantId,
      customer_code: customerCode,
      status: "draft",
      is_current: true,
    };
    if (addressCode) {
      scopeFilter.shipping_address_code = addressCode;
    }

    const activeCart = await Order.findOne(scopeFilter);
    let parkedCart = null;

    if (activeCart) {
      if (activeCart.items && activeCart.items.length > 0) {
        activeCart.is_current = false;
        if (!activeCart.cart_name) {
          const dateStr = new Date().toISOString().slice(0, 10);
          activeCart.cart_name = `Parked ${dateStr}`;
        }
        await activeCart.save();
        parkedCart = {
          order_id: activeCart.order_id,
          cart_name: activeCart.cart_name,
        };
      } else {
        activeCart.status = "deleted" as any;
        activeCart.is_current = false;
        activeCart.deleted_at = new Date();
        await activeCart.save();
      }
    }

    // Undo submitOrder(): restore to editable draft cart
    order.status = "draft";
    order.is_current = true;

    // Clear processing state (the Windmill job is no longer relevant)
    order.processing_status = undefined;
    order.processing_job_id = undefined;
    order.processing_started_at = undefined;
    order.processing_completed_at = undefined;
    // processing_errors intentionally KEPT — the UI uses them to highlight
    // which rows had anomalies so the user knows what to fix

    // Clear submission metadata so submitOrder() can run again
    order.submitted_at = undefined;
    order.confirmed_at = undefined;
    order.order_number = undefined;

    await order.save();

    return NextResponse.json({
      success: true,
      order: order.toObject(),
      parked_cart: parkedCart,
    });
  } catch (error) {
    console.error("Error reverting order to cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revert order to cart" },
      { status: 500 },
    );
  }
}
