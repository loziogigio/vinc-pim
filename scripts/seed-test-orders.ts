/**
 * Seed Test Orders Script
 *
 * Creates sample orders for testing the Orders frontend
 * Run with: npx tsx scripts/seed-test-orders.ts
 *
 * Options:
 *   --customer-id <id>   Customer ID (default: test-customer-123)
 *   --tenant-id <id>     Tenant ID (default: from VINC_TENANT_ID env or "hidros-it")
 *   --clear              Delete existing orders for this customer first
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { config } from "dotenv";

config({ path: ".env" });

// Parse command line arguments
function parseArgs(): { customerId: string; tenantId: string; clear: boolean } {
  const args = process.argv.slice(2);
  let customerId = "test-customer-123";
  let tenantId = process.env.VINC_TENANT_ID || "hidros-it";
  let clear = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--customer-id" && args[i + 1]) {
      customerId = args[i + 1];
      i++;
    } else if (args[i] === "--tenant-id" && args[i + 1]) {
      tenantId = args[i + 1];
      i++;
    } else if (args[i] === "--clear") {
      clear = true;
    }
  }

  return { customerId, tenantId, clear };
}

// Order Schema (inline to avoid import issues)
const LineItemSchema = new mongoose.Schema({
  line_number: { type: Number, required: true },
  entity_code: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true },
  quantity_unit: String,
  min_order_quantity: Number,
  pack_size: Number,
  list_price: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  promo_price: Number,
  vat_rate: { type: Number, required: true },
  line_gross: { type: Number, required: true },
  line_net: { type: Number, required: true },
  line_vat: { type: Number, required: true },
  line_total: { type: Number, required: true },
  discounts: { type: [Object], default: [] },
  total_discount_percent: { type: Number, default: 0 },
  promo_id: String,
  is_gift_line: { type: Boolean, default: false },
  gift_with_purchase: String,
  name: { type: String, required: true },
  image_url: String,
  brand: String,
  category: String,
  added_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  added_from: String,
  added_via: String,
});

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  order_number: Number,
  year: { type: Number, required: true },
  status: { type: String, required: true, enum: ["draft", "pending", "confirmed", "shipped", "cancelled"] },
  tenant_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_code: String,
  shipping_address_id: String,
  billing_address_id: String,
  requested_delivery_date: Date,
  delivery_slot: String,
  delivery_route: String,
  shipping_method: String,
  price_list_id: { type: String, default: "default" },
  price_list_type: { type: String, default: "wholesale" },
  order_type: { type: String, default: "b2b" },
  currency: { type: String, default: "EUR" },
  subtotal_gross: { type: Number, default: 0 },
  subtotal_net: { type: Number, default: 0 },
  total_discount: { type: Number, default: 0 },
  total_vat: { type: Number, default: 0 },
  shipping_cost: { type: Number, default: 0 },
  order_total: { type: Number, default: 0 },
  po_reference: String,
  cost_center: String,
  notes: String,
  internal_notes: String,
  session_id: String,
  flow_id: String,
  source: String,
  items: [LineItemSchema],
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const OrderModel = mongoose.models.Order || mongoose.model("Order", OrderSchema, "orders");

// Sample products
const sampleProducts = [
  { entity_code: "PROD-001", sku: "SKU-001", name: "Premium Widget A", list_price: 25.00, unit_price: 20.00, vat_rate: 22, brand: "WidgetCo", category: "Widgets" },
  { entity_code: "PROD-002", sku: "SKU-002", name: "Deluxe Gadget B", list_price: 150.00, unit_price: 120.00, vat_rate: 22, brand: "GadgetPro", category: "Gadgets" },
  { entity_code: "PROD-003", sku: "SKU-003", name: "Standard Component C", list_price: 8.50, unit_price: 7.00, vat_rate: 10, brand: "ComponentMax", category: "Components" },
  { entity_code: "PROD-004", sku: "SKU-004", name: "Industrial Part D", list_price: 45.00, unit_price: 38.00, vat_rate: 22, brand: "IndustrialPro", category: "Parts" },
  { entity_code: "PROD-005", sku: "SKU-005", name: "Electronics Kit E", list_price: 299.00, unit_price: 250.00, vat_rate: 22, brand: "ElectroniX", category: "Kits" },
];

function calculateLineItem(product: typeof sampleProducts[0], quantity: number, lineNumber: number) {
  const line_gross = Math.round(quantity * product.list_price * 100) / 100;
  const line_net = Math.round(quantity * product.unit_price * 100) / 100;
  const line_vat = Math.round(line_net * (product.vat_rate / 100) * 100) / 100;
  const line_total = Math.round((line_net + line_vat) * 100) / 100;

  return {
    line_number: lineNumber,
    entity_code: product.entity_code,
    sku: product.sku,
    name: product.name,
    quantity,
    list_price: product.list_price,
    unit_price: product.unit_price,
    vat_rate: product.vat_rate,
    line_gross,
    line_net,
    line_vat,
    line_total,
    brand: product.brand,
    category: product.category,
    discounts: [],
    total_discount_percent: 0,
    is_gift_line: false,
    added_at: new Date(),
    updated_at: new Date(),
    added_from: "seed",
    added_via: "script",
  };
}

function calculateOrderTotals(items: ReturnType<typeof calculateLineItem>[]) {
  const subtotal_gross = Math.round(items.reduce((sum, i) => sum + i.line_gross, 0) * 100) / 100;
  const subtotal_net = Math.round(items.reduce((sum, i) => sum + i.line_net, 0) * 100) / 100;
  const total_vat = Math.round(items.reduce((sum, i) => sum + i.line_vat, 0) * 100) / 100;
  const total_discount = Math.round((subtotal_gross - subtotal_net) * 100) / 100;
  const order_total = Math.round((subtotal_net + total_vat) * 100) / 100;

  return { subtotal_gross, subtotal_net, total_vat, total_discount, order_total };
}

async function seedOrders() {
  const { customerId, tenantId, clear } = parseArgs();

  const mongoUrl = process.env.VINC_MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error("VINC_MONGO_URL or MONGODB_URI not set");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);
  console.log("Connected\n");

  console.log(`Configuration:`);
  console.log(`  Customer ID: ${customerId}`);
  console.log(`  Tenant ID:   ${tenantId}`);
  console.log(`  Clear:       ${clear}\n`);

  // Clear existing orders if requested
  if (clear) {
    const result = await OrderModel.deleteMany({ customer_id: customerId });
    console.log(`Deleted ${result.deletedCount} existing orders\n`);
  }

  const year = new Date().getFullYear();

  const ordersToCreate = [
    // Draft orders (active carts)
    {
      status: "draft",
      items: [
        calculateLineItem(sampleProducts[0], 10, 10),
        calculateLineItem(sampleProducts[1], 2, 20),
      ],
      notes: "Please deliver to warehouse entrance",
    },
    {
      status: "draft",
      items: [
        calculateLineItem(sampleProducts[2], 50, 10),
        calculateLineItem(sampleProducts[3], 5, 20),
        calculateLineItem(sampleProducts[4], 1, 30),
      ],
      po_reference: "PO-2025-001",
    },
    // Pending orders
    {
      status: "pending",
      items: [
        calculateLineItem(sampleProducts[1], 5, 10),
        calculateLineItem(sampleProducts[4], 2, 20),
      ],
      po_reference: "PO-2025-002",
      notes: "Urgent delivery needed",
    },
    {
      status: "pending",
      items: [
        calculateLineItem(sampleProducts[0], 100, 10),
      ],
      shipping_address_id: "addr-001",
    },
    // Confirmed orders
    {
      status: "confirmed",
      order_number: 1,
      items: [
        calculateLineItem(sampleProducts[2], 200, 10),
        calculateLineItem(sampleProducts[3], 50, 20),
      ],
      po_reference: "PO-2024-050",
      shipping_address_id: "addr-001",
      confirmed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    // Shipped orders
    {
      status: "shipped",
      order_number: 2,
      items: [
        calculateLineItem(sampleProducts[4], 3, 10),
      ],
      po_reference: "PO-2024-048",
      shipping_address_id: "addr-002",
      confirmed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      status: "shipped",
      order_number: 3,
      items: [
        calculateLineItem(sampleProducts[0], 25, 10),
        calculateLineItem(sampleProducts[1], 10, 20),
        calculateLineItem(sampleProducts[2], 100, 30),
      ],
      po_reference: "PO-2024-045",
      shipping_address_id: "addr-001",
      confirmed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    },
    // Cancelled order
    {
      status: "cancelled",
      items: [
        calculateLineItem(sampleProducts[3], 10, 10),
      ],
      internal_notes: "Customer requested cancellation",
    },
    // Additional orders to reach 15 total
    // Draft - large B2B order
    {
      status: "draft",
      items: [
        calculateLineItem(sampleProducts[0], 200, 10),
        calculateLineItem(sampleProducts[1], 50, 20),
        calculateLineItem(sampleProducts[2], 500, 30),
        calculateLineItem(sampleProducts[3], 100, 40),
      ],
      po_reference: "PO-2025-003",
      notes: "Large quarterly order",
    },
    // Pending - with specific delivery date
    {
      status: "pending",
      items: [
        calculateLineItem(sampleProducts[4], 5, 10),
        calculateLineItem(sampleProducts[0], 30, 20),
      ],
      po_reference: "PO-2025-004",
      requested_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      delivery_slot: "morning",
    },
    // Confirmed - awaiting shipment
    {
      status: "confirmed",
      order_number: 4,
      items: [
        calculateLineItem(sampleProducts[1], 15, 10),
        calculateLineItem(sampleProducts[3], 25, 20),
      ],
      po_reference: "PO-2025-005",
      shipping_address_id: "addr-001",
      confirmed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    // Shipped - recent delivery
    {
      status: "shipped",
      order_number: 5,
      items: [
        calculateLineItem(sampleProducts[2], 300, 10),
        calculateLineItem(sampleProducts[4], 2, 20),
      ],
      po_reference: "PO-2024-055",
      shipping_address_id: "addr-002",
      confirmed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    // Draft - small reorder
    {
      status: "draft",
      items: [
        calculateLineItem(sampleProducts[3], 20, 10),
      ],
      notes: "Reorder from previous shipment",
    },
    // Pending - express shipping
    {
      status: "pending",
      items: [
        calculateLineItem(sampleProducts[0], 50, 10),
        calculateLineItem(sampleProducts[4], 1, 20),
      ],
      po_reference: "PO-2025-006",
      shipping_method: "express",
      notes: "EXPRESS - Next day delivery required",
    },
    // Confirmed - multiple items
    {
      status: "confirmed",
      order_number: 6,
      items: [
        calculateLineItem(sampleProducts[0], 40, 10),
        calculateLineItem(sampleProducts[1], 8, 20),
        calculateLineItem(sampleProducts[2], 150, 30),
        calculateLineItem(sampleProducts[3], 30, 40),
        calculateLineItem(sampleProducts[4], 4, 50),
      ],
      po_reference: "PO-2025-007",
      shipping_address_id: "addr-001",
      confirmed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      cost_center: "DEPT-SALES",
    },
  ];

  console.log(`Creating ${ordersToCreate.length} test orders...\n`);

  for (let i = 0; i < ordersToCreate.length; i++) {
    const orderData = ordersToCreate[i];
    const totals = calculateOrderTotals(orderData.items);
    const order_id = nanoid(12);

    // Vary the created_at dates
    const daysAgo = Math.floor(Math.random() * 30);
    const created_at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const order = await OrderModel.create({
      order_id,
      year,
      status: orderData.status,
      order_number: orderData.order_number,
      tenant_id: tenantId,
      customer_id: customerId,
      customer_code: "CLI-001",
      shipping_address_id: orderData.shipping_address_id,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      ...totals,
      shipping_cost: 0,
      po_reference: orderData.po_reference,
      notes: orderData.notes,
      internal_notes: orderData.internal_notes,
      session_id: `sess_${nanoid(16)}`,
      flow_id: `flow_${nanoid(16)}`,
      source: "seed",
      items: orderData.items,
      confirmed_at: orderData.confirmed_at,
      created_at,
      updated_at: created_at,
    });

    const statusEmoji: Record<string, string> = {
      draft: "[CART]",
      pending: "[PENDING]",
      confirmed: "[CONFIRMED]",
      shipped: "[SHIPPED]",
      cancelled: "[CANCELLED]",
    };

    console.log(
      `${statusEmoji[orderData.status].padEnd(12)} | ${order.order_id} | ${order.items.length} items | EUR ${order.order_total.toFixed(2)}`
    );
  }

  console.log("\nTest orders created successfully!");
  console.log(`\nSummary by status:`);

  const statusCounts = await OrderModel.aggregate([
    { $match: { customer_id: customerId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  for (const s of statusCounts) {
    console.log(`   ${s._id}: ${s.count}`);
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB");
}

seedOrders().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
