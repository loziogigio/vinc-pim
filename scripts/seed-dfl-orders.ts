/**
 * Seed Test Orders for DFL Tenant
 *
 * Creates sample orders for the dfl-eventi-it tenant
 * Run with: npx tsx scripts/seed-dfl-orders.ts
 *
 * Options:
 *   --clear   Delete existing test orders first
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { config } from "dotenv";

config({ path: ".env" });

const TENANT_ID = "dfl-eventi-it";
const DB_NAME = `vinc-${TENANT_ID}`;

// Parse command line arguments
function parseArgs(): { clear: boolean } {
  const args = process.argv.slice(2);
  return { clear: args.includes("--clear") };
}

// Customer Schema (inline)
const CustomerSchema = new mongoose.Schema({
  customer_id: String,
  tenant_id: String,
  email: String,
  customer_type: String,
  company_name: String,
  first_name: String,
  last_name: String,
  public_code: String,
  addresses: [Object],
});

// Order Schema (inline)
const LineItemSchema = new mongoose.Schema({
  line_number: { type: Number, required: true },
  entity_code: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true },
  quantity_unit: String,
  list_price: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  vat_rate: { type: Number, required: true },
  line_gross: { type: Number, required: true },
  line_net: { type: Number, required: true },
  line_vat: { type: Number, required: true },
  line_total: { type: Number, required: true },
  discounts: { type: [Object], default: [] },
  total_discount_percent: { type: Number, default: 0 },
  is_gift_line: { type: Boolean, default: false },
  name: { type: String, required: true },
  image_url: String,
  brand: String,
  category: String,
  added_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  added_from: String,
  added_via: String,
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  order_number: Number,
  cart_number: Number,
  year: { type: Number, required: true },
  status: { type: String, required: true, enum: ["draft", "pending", "confirmed", "shipped", "cancelled"] },
  is_current: { type: Boolean, default: false },
  tenant_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_code: String,
  shipping_address_id: String,
  billing_address_id: String,
  requested_delivery_date: Date,
  delivery_slot: String,
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
  confirmed_at: Date,
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

// Sample products for DFL (Event Planning Company)
const sampleProducts = [
  { entity_code: "EVT-TENT-001", sku: "TENT-10X10", name: "Gazebo 10x10m Bianco", list_price: 450.00, unit_price: 380.00, vat_rate: 22, brand: "EventPro", category: "Tensostrutture" },
  { entity_code: "EVT-CHAIR-001", sku: "CHAIR-FOLD", name: "Sedia Pieghevole Premium", list_price: 25.00, unit_price: 18.00, vat_rate: 22, brand: "SeatCo", category: "Sedie" },
  { entity_code: "EVT-TABLE-001", sku: "TABLE-ROUND", name: "Tavolo Rotondo 180cm", list_price: 120.00, unit_price: 95.00, vat_rate: 22, brand: "TableMax", category: "Tavoli" },
  { entity_code: "EVT-LIGHT-001", sku: "LIGHT-LED", name: "Faro LED RGB 100W", list_price: 85.00, unit_price: 65.00, vat_rate: 22, brand: "LightShow", category: "Illuminazione" },
  { entity_code: "EVT-SOUND-001", sku: "SOUND-SPEAK", name: "Cassa Amplificata 500W", list_price: 350.00, unit_price: 280.00, vat_rate: 22, brand: "AudioPro", category: "Audio" },
  { entity_code: "EVT-DECOR-001", sku: "DECOR-FLOW", name: "Composizione Floreale Grande", list_price: 75.00, unit_price: 55.00, vat_rate: 10, brand: "FloralArt", category: "Decorazioni" },
  { entity_code: "EVT-STAGE-001", sku: "STAGE-MOD", name: "Modulo Palco 2x1m", list_price: 200.00, unit_price: 160.00, vat_rate: 22, brand: "StagePro", category: "Palchi" },
  { entity_code: "EVT-CARPET-001", sku: "CARPET-RED", name: "Passatoia Rossa (mt)", list_price: 15.00, unit_price: 10.00, vat_rate: 22, brand: "CarpetKing", category: "Accessori" },
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
  const { clear } = parseArgs();

  const mongoUrl = process.env.VINC_MONGO_URL || process.env.MONGODB_URI || "mongodb://admin:admin@localhost:27017/?authSource=admin";

  // Connect to DFL tenant database using dbName option
  console.log(`Connecting to ${DB_NAME}...`);
  await mongoose.connect(mongoUrl, {
    dbName: DB_NAME,
  });
  console.log("Connected\n");

  const CustomerModel = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema, "customers");
  const OrderModel = mongoose.models.Order || mongoose.model("Order", OrderSchema, "orders");

  // Check for existing customers
  const customers = await CustomerModel.find({ tenant_id: TENANT_ID }).limit(5).lean();

  if (customers.length === 0) {
    console.log("No customers found in DFL tenant. Creating test customers first...\n");

    // Create test customers
    const testCustomers = [
      {
        customer_id: `CUST-DFL-${nanoid(8)}`,
        tenant_id: TENANT_ID,
        email: "eventi.milano@test.com",
        customer_type: "business",
        company_name: "Eventi Milano Srl",
        public_code: "C-001",
        addresses: [{
          address_id: `addr-${nanoid(6)}`,
          address_type: "both",
          label: "Sede Principale",
          street_address: "Via Eventi 123",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
          is_default: true,
        }],
      },
      {
        customer_id: `CUST-DFL-${nanoid(8)}`,
        tenant_id: TENANT_ID,
        email: "wedding.roma@test.com",
        customer_type: "business",
        company_name: "Wedding Planner Roma",
        public_code: "C-002",
        addresses: [{
          address_id: `addr-${nanoid(6)}`,
          address_type: "both",
          label: "Ufficio",
          street_address: "Via Matrimoni 45",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
          country: "IT",
          is_default: true,
        }],
      },
      {
        customer_id: `CUST-DFL-${nanoid(8)}`,
        tenant_id: TENANT_ID,
        email: "corporate.events@test.com",
        customer_type: "business",
        company_name: "Corporate Events Italia",
        public_code: "C-003",
        addresses: [{
          address_id: `addr-${nanoid(6)}`,
          address_type: "both",
          label: "Magazzino",
          street_address: "Via Industriale 78",
          city: "Torino",
          province: "TO",
          postal_code: "10100",
          country: "IT",
          is_default: true,
        }],
      },
    ];

    for (const c of testCustomers) {
      await CustomerModel.create(c);
      console.log(`Created customer: ${c.company_name} (${c.customer_id})`);
    }
    customers.push(...testCustomers);
    console.log("");
  }

  console.log(`Found ${customers.length} customers in DFL tenant\n`);

  // Clear existing test orders if requested
  if (clear) {
    const result = await OrderModel.deleteMany({ tenant_id: TENANT_ID, source: "seed" });
    console.log(`Deleted ${result.deletedCount} existing seed orders\n`);
  }

  const year = new Date().getFullYear();
  let cartNumberCounter = 100;
  let orderNumberCounter = 1000;

  // Create orders for each customer
  const ordersToCreate: Array<{
    customerId: string;
    customerCode: string;
    addressId?: string;
    status: string;
    items: ReturnType<typeof calculateLineItem>[];
    orderNumber?: number;
    cartNumber?: number;
    isCurrent?: boolean;
    notes?: string;
    poReference?: string;
    confirmedAt?: Date;
    requestedDeliveryDate?: Date;
    shippingMethod?: string;
  }> = [];

  for (const customer of customers) {
    const customerId = customer.customer_id as string;
    const customerCode = (customer.public_code as string) || customerId.slice(0, 8);
    const addressId = customer.addresses?.[0]?.address_id as string;

    // Current cart (draft)
    ordersToCreate.push({
      customerId,
      customerCode,
      addressId,
      status: "draft",
      isCurrent: true,
      cartNumber: cartNumberCounter++,
      items: [
        calculateLineItem(sampleProducts[1], 50, 10),  // 50 sedie
        calculateLineItem(sampleProducts[2], 10, 20),  // 10 tavoli
        calculateLineItem(sampleProducts[5], 20, 30),  // 20 composizioni floreali
      ],
      notes: "Matrimonio Villa Rossi - 15 Febbraio",
    });

    // Another draft (not current)
    ordersToCreate.push({
      customerId,
      customerCode,
      addressId,
      status: "draft",
      cartNumber: cartNumberCounter++,
      items: [
        calculateLineItem(sampleProducts[0], 2, 10),   // 2 gazebo
        calculateLineItem(sampleProducts[3], 20, 20),  // 20 fari LED
      ],
      notes: "Preventivo evento aziendale",
    });

    // Pending order
    ordersToCreate.push({
      customerId,
      customerCode,
      addressId,
      status: "pending",
      items: [
        calculateLineItem(sampleProducts[4], 4, 10),   // 4 casse
        calculateLineItem(sampleProducts[3], 30, 20),  // 30 fari
        calculateLineItem(sampleProducts[6], 8, 30),   // 8 moduli palco
      ],
      poReference: `PO-DFL-${nanoid(6).toUpperCase()}`,
      requestedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: "Concerto Piazza Duomo - Urgente",
    });

    // Confirmed order
    ordersToCreate.push({
      customerId,
      customerCode,
      addressId,
      status: "confirmed",
      orderNumber: orderNumberCounter++,
      items: [
        calculateLineItem(sampleProducts[1], 200, 10), // 200 sedie
        calculateLineItem(sampleProducts[2], 25, 20),  // 25 tavoli
        calculateLineItem(sampleProducts[7], 100, 30), // 100mt passatoia
        calculateLineItem(sampleProducts[5], 50, 40),  // 50 composizioni
      ],
      poReference: `PO-DFL-${nanoid(6).toUpperCase()}`,
      confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      notes: "Gala beneficenza - Palazzo Reale",
    });

    // Shipped order (old)
    ordersToCreate.push({
      customerId,
      customerCode,
      addressId,
      status: "shipped",
      orderNumber: orderNumberCounter++,
      items: [
        calculateLineItem(sampleProducts[0], 5, 10),   // 5 gazebo
        calculateLineItem(sampleProducts[1], 100, 20), // 100 sedie
        calculateLineItem(sampleProducts[3], 40, 30),  // 40 fari
      ],
      poReference: `PO-DFL-${nanoid(6).toUpperCase()}`,
      confirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      shippingMethod: "express",
    });
  }

  console.log(`Creating ${ordersToCreate.length} test orders...\n`);

  for (const orderData of ordersToCreate) {
    const totals = calculateOrderTotals(orderData.items);
    const order_id = `ORD-DFL-${nanoid(8)}`;

    // Vary creation dates
    const daysAgo = orderData.status === "shipped" ? 15 + Math.floor(Math.random() * 30) :
                    orderData.status === "confirmed" ? 5 + Math.floor(Math.random() * 10) :
                    orderData.status === "pending" ? Math.floor(Math.random() * 5) :
                    Math.floor(Math.random() * 3);
    const created_at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    await OrderModel.create({
      order_id,
      year,
      status: orderData.status,
      order_number: orderData.orderNumber,
      cart_number: orderData.cartNumber,
      is_current: orderData.isCurrent || false,
      tenant_id: TENANT_ID,
      customer_id: orderData.customerId,
      customer_code: orderData.customerCode,
      shipping_address_id: orderData.addressId,
      billing_address_id: orderData.addressId,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      ...totals,
      shipping_cost: 0,
      po_reference: orderData.poReference,
      notes: orderData.notes,
      requested_delivery_date: orderData.requestedDeliveryDate,
      shipping_method: orderData.shippingMethod,
      session_id: `sess_${nanoid(16)}`,
      flow_id: `flow_${nanoid(16)}`,
      source: "seed",
      items: orderData.items,
      confirmed_at: orderData.confirmedAt,
      created_at,
      updated_at: created_at,
    });

    const statusEmoji: Record<string, string> = {
      draft: "🛒 CART",
      pending: "⏳ PENDING",
      confirmed: "✅ CONFIRMED",
      shipped: "📦 SHIPPED",
      cancelled: "❌ CANCELLED",
    };

    console.log(
      `${statusEmoji[orderData.status].padEnd(14)} | ${order_id} | ${orderData.items.length} items | EUR ${totals.order_total.toFixed(2).padStart(10)}`
    );
  }

  console.log("\n" + "=".repeat(70));
  console.log("Test orders created successfully for DFL tenant!");
  console.log("=".repeat(70));

  // Summary
  console.log("\nSummary by status:");
  const statusCounts = await OrderModel.aggregate([
    { $match: { tenant_id: TENANT_ID } },
    { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$order_total" } } },
    { $sort: { _id: 1 } },
  ]);

  for (const s of statusCounts) {
    console.log(`   ${s._id.padEnd(12)}: ${s.count} orders (EUR ${s.total.toFixed(2)})`);
  }

  // Total
  const totalOrders = await OrderModel.countDocuments({ tenant_id: TENANT_ID });
  const totalValue = statusCounts.reduce((sum, s) => sum + s.total, 0);
  console.log(`\n   TOTAL: ${totalOrders} orders (EUR ${totalValue.toFixed(2)})`);

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB");
}

seedOrders().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
