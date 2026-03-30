import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * POST /api/b2b/cart/save
 * Save the active cart (set is_current=false, assign cart_name).
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const body = await req.json();
    const { order_id, cart_name } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }
    const trimmedName = (cart_name || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "cart_name is required" }, { status: 400 });
    }
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: "cart_name max 100 characters" }, { status: 400 });
    }

    const { Order } = await connectWithModels(tenantDb);

    const order = await Order.findOne({
      tenant_id: tenantId,
      order_id,
      status: "draft",
      is_current: true,
    });

    if (!order) {
      return NextResponse.json({ error: "Active cart not found" }, { status: 404 });
    }

    if (!order.items || order.items.length === 0) {
      return NextResponse.json({ error: "Cannot save an empty cart" }, { status: 400 });
    }

    order.is_current = false;
    order.cart_name = trimmedName;
    await order.save();

    return NextResponse.json({
      success: true,
      order_id: order.order_id,
      cart_name: trimmedName,
    });
  } catch (error) {
    console.error("Error saving cart:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
