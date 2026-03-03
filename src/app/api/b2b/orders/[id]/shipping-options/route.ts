import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  fetchShippingConfig,
  findZoneForCountry,
  getAvailableShippingOptions,
} from "@/lib/services/delivery-cost.service";
import { PAYMENT_METHODS } from "@/lib/constants/payment";
import type { IOrder } from "@/lib/db/models/order";
import type { ICustomer } from "@/lib/db/models/customer";
import type { ShippingMethodOption } from "@/lib/types/shipping";

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { id: order_id } = await params;
    const { tenantId, tenantDb } = auth;

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

    // Resolve effective payment methods per option:
    // intersection of shipping method's allowed_payment_methods and tenant's enabled_methods
    const { TenantPaymentConfig } = await connectWithModels(tenantDb);
    const paymentConfig = await TenantPaymentConfig.findOne({
      tenant_id: tenantId,
    }).lean();
    const tenantEnabledMethods: string[] =
      paymentConfig?.enabled_methods?.length
        ? paymentConfig.enabled_methods
        : [...PAYMENT_METHODS];

    const resolved: ShippingMethodOption[] = options.map((opt) => {
      const methodRestrictions = opt.allowed_payment_methods;
      // If shipping method has restrictions, intersect with tenant enabled methods
      // Otherwise, all tenant enabled methods are allowed
      const effective =
        methodRestrictions && methodRestrictions.length > 0
          ? tenantEnabledMethods.filter((m) => methodRestrictions.includes(m))
          : tenantEnabledMethods;
      return { ...opt, allowed_payment_methods: effective };
    });

    return NextResponse.json({
      success: true,
      data: {
        zone_name: zone?.name ?? null,
        country: shippingAddress.country,
        options: resolved,
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
