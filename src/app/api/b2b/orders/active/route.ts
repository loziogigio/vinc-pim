import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { nanoid } from "nanoid";

/**
 * GET /api/b2b/orders/active
 * Find or create active cart for current customer
 *
 * An "active" cart is a draft order for the customer.
 * If no draft exists, creates one automatically.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Order: OrderModel } = await connectWithModels(tenantDb);

    const tenant_id = session.tenantId;

    // Try to find existing draft order for this customer
    let order = await OrderModel.findOne({
      tenant_id,
      customer_id: session.userId,
      status: "draft",
    })
      .sort({ created_at: -1 }) // Get most recent draft
      .lean();

    // If no draft exists, create one
    if (!order) {
      const order_id = nanoid(12);
      const session_id = `sess_${nanoid(16)}`;
      const flow_id = `flow_${nanoid(16)}`;
      const year = new Date().getFullYear();

      const newOrder = await OrderModel.create({
        order_id,
        year,
        status: "draft",

        // Tenant
        tenant_id,

        // Customer
        customer_id: session.userId,
        shipping_address_id: null, // null until checkout

        // Pricing Context (defaults)
        price_list_id: "default",
        price_list_type: "wholesale",
        order_type: "b2b",
        currency: "EUR",

        // Totals (all 0)
        subtotal_gross: 0,
        subtotal_net: 0,
        total_discount: 0,
        total_vat: 0,
        shipping_cost: 0,
        order_total: 0,

        // Tracking
        session_id,
        flow_id,
        source: "web",

        // Items (empty)
        items: [],
      });

      order = newOrder.toObject();
    }

    return NextResponse.json({
      success: true,
      order,
      created: !order._id, // Indicates if a new cart was created
    });
  } catch (error) {
    console.error("Error getting active cart:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
