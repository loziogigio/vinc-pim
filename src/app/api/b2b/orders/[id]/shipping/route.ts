import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import {
  fetchShippingConfig,
  findZoneForCountry,
  computeMethodCost,
} from "@/lib/services/delivery-cost.service";
import type { ICustomer } from "@/lib/db/models/customer";

/**
 * POST /api/b2b/orders/[id]/shipping
 *
 * Apply a shipping method to a draft order.
 * Recomputes the cost using current tiers and order subtotal, then saves.
 *
 * Body: { method_id: string }
 *
 * Response: { shipping_method, shipping_cost, order_total }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: order_id } = await params;
    const tenantId = session.tenantId;
    const tenantDb = `vinc-${tenantId}`;

    const body = await req.json();
    const { method_id } = body as { method_id: string };

    if (!method_id) {
      return NextResponse.json(
        { error: "method_id is required" },
        { status: 400 }
      );
    }

    const { Order: OrderModel, Customer: CustomerModel } =
      await connectWithModels(tenantDb);

    // Fetch as Mongoose document to call recalculateTotals()
    const order = await OrderModel.findOne({ order_id, tenant_id: tenantId });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "draft") {
      return NextResponse.json(
        { error: "Shipping can only be set on draft orders" },
        { status: 400 }
      );
    }

    if (!order.shipping_address_id || !order.customer_id) {
      return NextResponse.json(
        { error: "Order must have a shipping address before selecting a shipping method" },
        { status: 400 }
      );
    }

    // Resolve shipping address country
    const customer = await CustomerModel.findOne({
      customer_id: order.customer_id,
      tenant_id: tenantId,
    }).lean<ICustomer>();

    const shippingAddress = customer?.addresses?.find(
      (a) => a.address_id === order.shipping_address_id
    );

    if (!shippingAddress?.country) {
      return NextResponse.json(
        { error: "Shipping address has no country set" },
        { status: 400 }
      );
    }

    // Load shipping config and find the selected method
    const config = await fetchShippingConfig(tenantDb);
    if (!config) {
      return NextResponse.json(
        { error: "No shipping configuration found for this tenant" },
        { status: 400 }
      );
    }

    const zone = findZoneForCountry(config, shippingAddress.country);
    if (!zone) {
      return NextResponse.json(
        { error: `No shipping zone configured for country: ${shippingAddress.country}` },
        { status: 400 }
      );
    }

    const method = zone.methods.find(
      (m) => m.method_id === method_id && m.enabled
    );
    if (!method) {
      return NextResponse.json(
        { error: "Shipping method not found or not available" },
        { status: 404 }
      );
    }

    // Compute cost against current order subtotal
    const computedCost = computeMethodCost(method, order.subtotal_net ?? 0);

    // Apply shipping: update cost and recompute order_total from existing subtotals
    order.shipping_method = method.name;
    order.shipping_cost = computedCost;
    order.order_total = Math.round((order.subtotal_net + order.total_vat + computedCost) * 100) / 100;

    await order.save();

    return NextResponse.json({
      success: true,
      data: {
        shipping_method: order.shipping_method,
        shipping_cost: order.shipping_cost,
        order_total: order.order_total,
      },
    });
  } catch (error) {
    console.error("POST /api/b2b/orders/[id]/shipping error:", error);
    return NextResponse.json(
      { error: "Failed to apply shipping method" },
      { status: 500 }
    );
  }
}
