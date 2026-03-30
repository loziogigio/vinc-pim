/**
 * GET /api/b2b/orders/processing
 *
 * List orders currently in processing or failed state for a customer.
 * Used by the "Ordini in elaborazione" tab in the B2B cart.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, tenantId } = auth;
    const { Order } = await connectWithModels(tenantDb);

    const url = new URL(req.url);
    const customerCode = url.searchParams.get("customer_code");
    const addressCode = url.searchParams.get("address_code");

    if (!customerCode) {
      return NextResponse.json({ error: "customer_code is required" }, { status: 400 });
    }

    const filter: Record<string, unknown> = {
      tenant_id: tenantId,
      customer_code: customerCode,
      status: { $in: ["draft", "pending", "confirmed"] },
      processing_status: { $in: ["processing", "failed"] },
    };

    if (addressCode) {
      filter.shipping_address_code = addressCode;
    }

    const orders = await Order.find(
      filter,
      "order_id order_number cart_number erp_cart_id erp_data status processing_status processing_phase processing_started_at processing_completed_at processing_errors erp_sync_status subtotal_net order_total items created_at submitted_at",
    )
      .sort({ submitted_at: -1 })
      .limit(50)
      .lean();

    // Return with item_count computed from items array length
    const result = orders.map((o: any) => ({
      order_id: o.order_id,
      order_number: o.order_number,
      cart_number: o.cart_number,
      erp_cart_id: o.erp_cart_id || o.erp_data?.erp_order_id || null,
      erp_data: o.erp_data ? { anomalies: o.erp_data.anomalies } : undefined,
      status: o.status,
      processing_status: o.processing_status,
      processing_phase: o.processing_phase,
      processing_started_at: o.processing_started_at,
      processing_completed_at: o.processing_completed_at,
      processing_errors: o.processing_errors,
      erp_sync_status: o.erp_sync_status,
      item_count: o.items?.length || 0,
      items: (o.items || []).map((item: any) => ({
        line_number: item.line_number,
        sku: item.sku,
        entity_code: item.entity_code,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        list_price: item.list_price,
        line_net: item.line_net,
        image_url: item.image_url,
        erp_line_number: item.erp_line_number,
      })),
      subtotal_net: o.subtotal_net,
      order_total: o.order_total,
      created_at: o.created_at,
      submitted_at: o.submitted_at,
    }));

    return NextResponse.json({
      success: true,
      orders: result,
    });
  } catch (error) {
    console.error("Error listing processing orders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list processing orders" },
      { status: 500 },
    );
  }
}
