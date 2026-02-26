import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import {
  fetchShippingConfig,
  findZoneForCountry,
  getAvailableShippingOptions,
} from "@/lib/services/delivery-cost.service";
import type { IOrder } from "@/lib/db/models/order";
import type { ICustomer } from "@/lib/db/models/customer";

/**
 * GET /api/b2b/orders/[id]/shipping-options
 *
 * Returns available shipping methods with computed costs for a draft order.
 * Resolves: order → shipping_address_id → customer address → country → zone → methods.
 *
 * Response:
 *   { zone_name: string | null, options: ShippingMethodOption[] }
 */
export async function GET(
  _req: NextRequest,
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

    const { Order: OrderModel, Customer: CustomerModel } =
      await connectWithModels(tenantDb);

    const order = await OrderModel.findOne({
      order_id,
      tenant_id: tenantId,
    }).lean<IOrder>();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Need a shipping address to determine the zone
    if (!order.shipping_address_id || !order.customer_id) {
      return NextResponse.json({
        success: true,
        data: { zone_name: null, options: [] },
      });
    }

    const customer = await CustomerModel.findOne({
      customer_id: order.customer_id,
      tenant_id: tenantId,
    }).lean<ICustomer>();

    const shippingAddress = customer?.addresses?.find(
      (a) => a.address_id === order.shipping_address_id
    );

    if (!shippingAddress?.country) {
      return NextResponse.json({
        success: true,
        data: { zone_name: null, options: [] },
      });
    }

    const config = await fetchShippingConfig(tenantDb);
    if (!config) {
      return NextResponse.json({
        success: true,
        data: { zone_name: null, options: [] },
      });
    }

    const zone = findZoneForCountry(config, shippingAddress.country);
    const options = getAvailableShippingOptions(
      config,
      shippingAddress.country,
      order.subtotal_net ?? 0
    );

    return NextResponse.json({
      success: true,
      data: {
        zone_name: zone?.name ?? null,
        country: shippingAddress.country,
        options,
      },
    });
  } catch (error) {
    console.error("GET /api/b2b/orders/[id]/shipping-options error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping options" },
      { status: 500 }
    );
  }
}
