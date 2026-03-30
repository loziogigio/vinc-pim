import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * POST /api/b2b/cart/activate
 * Reactivate a saved cart: set is_current=true.
 * If there's an existing active cart, auto-park it (is_current=false).
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const { order_id, customer_code, address_code } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }
    if (!customer_code) {
      return NextResponse.json({ error: "customer_code is required" }, { status: 400 });
    }

    const { Order } = await connectWithModels(tenantDb);

    // Find the saved cart to reactivate
    const savedCart = await Order.findOne({
      tenant_id: tenantId,
      order_id,
      status: "draft",
      is_current: { $ne: true },
    });

    if (!savedCart) {
      return NextResponse.json({ error: "Saved cart not found" }, { status: 404 });
    }

    // Build filter for same customer+address scope
    const scopeFilter: Record<string, unknown> = {
      tenant_id: tenantId,
      customer_code,
      status: "draft",
      is_current: true,
    };
    if (address_code) {
      scopeFilter.shipping_address_code = address_code;
    }

    // Find the currently active cart (if any)
    const activeCart = await Order.findOne(scopeFilter);

    let parkedCart = null;

    if (activeCart) {
      if (activeCart.items && activeCart.items.length > 0) {
        // Park it: set is_current=false, auto-name if no cart_name
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
        // Empty active cart — delete it
        activeCart.status = "deleted" as any;
        activeCart.is_current = false;
        activeCart.deleted_at = new Date();
        await activeCart.save();
      }
    }

    // Activate the saved cart
    savedCart.is_current = true;

    // Clear processing metadata if this was a failed/processing order
    if (savedCart.processing_status) {
      savedCart.processing_status = undefined;
      savedCart.processing_job_id = undefined;
      savedCart.processing_phase = undefined;
      savedCart.processing_started_at = undefined;
      savedCart.processing_completed_at = undefined;
      savedCart.submitting = undefined;
      savedCart.submitted_at = undefined;
      savedCart.confirmed_at = undefined;
      savedCart.order_number = undefined;
    }

    await savedCart.save();

    return NextResponse.json({
      success: true,
      cart_id: savedCart.order_id,
      order_id: savedCart.order_id,
      cart_name: savedCart.cart_name,
      is_new: false,
      parked_cart: parkedCart,
      order: savedCart.toObject(),
    });
  } catch (error) {
    console.error("Error activating cart:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
