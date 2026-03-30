import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/b2b/cart/saved
 * List saved (parked) carts for a customer+address.
 * Query: customer_code, address_code, page, limit
 */
export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantDb, tenantId } = auth;

  try {
    const searchParams = req.nextUrl.searchParams;
    const customerCode = searchParams.get("customer_code");
    const addressCode = searchParams.get("address_code");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    if (!customerCode) {
      return NextResponse.json({ error: "customer_code is required" }, { status: 400 });
    }

    const { Order } = await connectWithModels(tenantDb);

    const query: Record<string, unknown> = {
      tenant_id: tenantId,
      customer_code: customerCode,
      status: "draft",
      is_current: { $ne: true },
      processing_status: { $nin: ["processing", "failed"] },
    };

    if (addressCode) {
      query.shipping_address_code = addressCode;
    }

    const skip = (page - 1) * limit;

    const [carts, total] = await Promise.all([
      Order.find(query)
        .select("order_id cart_name cart_number year created_at updated_at subtotal_net subtotal_gross order_total items erp_cart_id")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const savedCarts = carts.map((cart: any) => ({
      order_id: cart.order_id,
      erp_cart_id: cart.erp_cart_id || null,
      cart_name: cart.cart_name || "",
      cart_number: cart.cart_number,
      year: cart.year,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
      subtotal_net: cart.subtotal_net || 0,
      subtotal_gross: cart.subtotal_gross || 0,
      order_total: cart.order_total || 0,
      item_count: cart.items?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      saved_carts: savedCarts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing saved carts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
