import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * GET /api/b2b/cart/active/id
 *
 * Read-only lookup of the current active draft cart id for a
 * (customer_code, address_code) tuple. Does NOT create, write, or fire hooks.
 *
 * Intended to be called by clients before mutating a cart, to verify that
 * the locally-cached cart id still matches the backend's current cart.
 * On 404, callers should fall back to POST /api/b2b/cart/active.
 *
 * Query params:
 *   - customer_code (required)
 *   - address_code  (required)
 *
 * Responses:
 *   200 { success: true, cart_id, order_id, cart_number, year }
 *   400 { error } — missing params
 *   404 { error: "No active cart" } — no matching current draft cart
 */
export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(req.url);
  const customer_code = searchParams.get("customer_code");
  const address_code = searchParams.get("address_code");

  if (!customer_code) {
    return NextResponse.json(
      { error: "customer_code is required" },
      { status: 400 },
    );
  }
  if (!address_code) {
    return NextResponse.json(
      { error: "address_code is required" },
      { status: 400 },
    );
  }

  const { Order: OrderModel } = await connectWithModels(auth.tenantDb);

  const cart = await OrderModel.findOne(
    {
      tenant_id: auth.tenantId,
      customer_code,
      shipping_address_code: address_code,
      status: "draft",
      is_current: true,
    },
    { order_id: 1, cart_number: 1, year: 1 },
  ).lean();

  if (!cart) {
    return NextResponse.json({ error: "No active cart" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    cart_id: cart.order_id,
    order_id: cart.order_id,
    cart_number: cart.cart_number,
    year: cart.year,
  });
}
