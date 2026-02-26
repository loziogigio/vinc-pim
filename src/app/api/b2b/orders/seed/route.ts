import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { nanoid } from "nanoid";

/**
 * POST /api/b2b/orders/seed
 * Create test orders
 * Body: { customer_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Order: OrderModel } = await connectWithModels(tenantDb);

    const body = await req.json().catch(() => ({}));
    const customer_id = body.customer_id;

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }
    const tenant_id = session.tenantId;
    const year = new Date().getFullYear();

    // Sample products
    const products = [
      { entity_code: "PROD-001", sku: "SKU-001", name: "Premium Widget A", list_price: 25.00, unit_price: 20.00, vat_rate: 22, brand: "WidgetCo" },
      { entity_code: "PROD-002", sku: "SKU-002", name: "Deluxe Gadget B", list_price: 150.00, unit_price: 120.00, vat_rate: 22, brand: "GadgetPro" },
      { entity_code: "PROD-003", sku: "SKU-003", name: "Standard Component C", list_price: 8.50, unit_price: 7.00, vat_rate: 10, brand: "ComponentMax" },
    ];

    const createItem = (product: typeof products[0], qty: number, lineNum: number) => {
      const line_gross = Math.round(qty * product.list_price * 100) / 100;
      const line_net = Math.round(qty * product.unit_price * 100) / 100;
      const line_vat = Math.round(line_net * (product.vat_rate / 100) * 100) / 100;
      const line_total = Math.round((line_net + line_vat) * 100) / 100;
      return {
        line_number: lineNum,
        entity_code: product.entity_code,
        sku: product.sku,
        name: product.name,
        quantity: qty,
        list_price: product.list_price,
        unit_price: product.unit_price,
        vat_rate: product.vat_rate,
        line_gross,
        line_net,
        line_vat,
        line_total,
        brand: product.brand,
        discounts: [],
        total_discount_percent: 0,
        is_gift_line: false,
        added_at: new Date(),
        updated_at: new Date(),
        added_from: "seed",
        added_via: "api",
      };
    };

    const calcTotals = (items: ReturnType<typeof createItem>[]) => ({
      subtotal_gross: Math.round(items.reduce((s, i) => s + i.line_gross, 0) * 100) / 100,
      subtotal_net: Math.round(items.reduce((s, i) => s + i.line_net, 0) * 100) / 100,
      total_vat: Math.round(items.reduce((s, i) => s + i.line_vat, 0) * 100) / 100,
      total_discount: Math.round(items.reduce((s, i) => s + i.line_gross - i.line_net, 0) * 100) / 100,
      order_total: Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100,
    });

    const statuses = ["draft", "pending", "confirmed", "shipped", "cancelled"];
    const ordersData = [];

    // Create 20 orders with varied statuses
    for (let i = 0; i < 20; i++) {
      const status = statuses[i % statuses.length];
      const itemCount = (i % 3) + 1; // 1-3 items per order
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const product = products[(i + j) % products.length];
        const qty = ((i + 1) * 5) + (j * 10);
        items.push(createItem(product, qty, (j + 1) * 10));
      }
      ordersData.push({
        status,
        items,
        po_reference: status !== "draft" ? `PO-2025-${String(i + 1).padStart(3, "0")}` : undefined,
        order_number: (status === "confirmed" || status === "shipped") ? i + 1 : undefined,
        notes: i % 4 === 0 ? `Test order ${i + 1}` : undefined,
        internal_notes: status === "cancelled" ? "Cancelled by customer" : undefined,
      });
    }

    const created = [];
    for (const data of ordersData) {
      const totals = calcTotals(data.items);
      const order = await OrderModel.create({
        order_id: nanoid(12),
        year,
        status: data.status,
        order_number: data.order_number,
        tenant_id,
        customer_id,
        customer_code: "CLI-001",
        price_list_id: "default",
        price_list_type: "wholesale",
        order_type: "b2b",
        currency: "EUR",
        ...totals,
        shipping_cost: 0,
        po_reference: data.po_reference,
        notes: data.notes,
        internal_notes: data.internal_notes,
        session_id: `sess_${nanoid(16)}`,
        flow_id: `flow_${nanoid(16)}`,
        source: "api",
        channel: "api",
        items: data.items,
      });
      created.push({ order_id: order.order_id, status: order.status, total: order.order_total });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} test orders`,
      customer_id,
      tenant_id,
      orders: created,
    });
  } catch (error) {
    console.error("Error seeding orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
