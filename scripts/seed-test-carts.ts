/**
 * Seed Test Carts Script
 *
 * Creates sample carts for testing the Cart API with is_current field
 * Run with: npx tsx scripts/seed-test-carts.ts
 *
 * Options:
 *   --customer-code <code>  Customer code (default: TEST-001)
 *   --tenant-id <id>        Tenant ID (default: from VINC_TENANT_ID env or "hidros-it")
 *   --clear                 Delete existing carts for this customer first
 *   --clear-all             Delete ALL orders and customers before seeding
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { config } from "dotenv";

config({ path: ".env" });

// Parse command line arguments
function parseArgs(): { customerCode: string; tenantId: string; clear: boolean; clearAll: boolean } {
  const args = process.argv.slice(2);
  let customerCode = "TEST-001";
  let tenantId = process.env.VINC_TENANT_ID || "hidros-it";
  let clear = false;
  let clearAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--customer-code" && args[i + 1]) {
      customerCode = args[i + 1];
      i++;
    } else if (args[i] === "--tenant-id" && args[i + 1]) {
      tenantId = args[i + 1];
      i++;
    } else if (args[i] === "--clear-all") {
      clearAll = true;
    } else if (args[i] === "--clear") {
      clear = true;
    }
  }

  return { customerCode, tenantId, clear, clearAll };
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
  promo_code: String,
  promo_row: Number,
  raw_data: { type: Object },
});

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  order_number: Number,
  cart_number: Number, // Sequential cart number per year
  year: { type: Number, required: true },
  status: { type: String, required: true, enum: ["draft", "pending", "confirmed", "shipped", "cancelled"] },
  is_current: { type: Boolean, default: false },
  tenant_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  customer_code: String,
  shipping_address_id: String,
  shipping_address_code: String,
  billing_address_id: String,
  requested_delivery_date: Date,
  delivery_slot: String,
  delivery_route: String,
  shipping_method: String,
  price_list_id: { type: String, default: "default" },
  price_list_type: { type: String, default: "wholesale" },
  order_type: { type: String, default: "b2b" },
  currency: { type: String, default: "EUR" },
  pricelist_type: String,
  pricelist_code: String,
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

// Customer Schema (inline to avoid import issues)
const AddressSchema = new mongoose.Schema({
  address_id: { type: String, required: true },
  external_code: String,
  address_type: { type: String, enum: ["delivery", "billing", "both"], default: "both" },
  label: String,
  is_default: { type: Boolean, default: false },
  recipient_name: { type: String, required: true },
  street_address: { type: String, required: true },
  street_address_2: String,
  city: { type: String, required: true },
  province: { type: String, required: true },
  postal_code: { type: String, required: true },
  country: { type: String, default: "IT" },
  phone: String,
  delivery_notes: String,
}, { _id: false, timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const CustomerSchema = new mongoose.Schema({
  customer_id: { type: String, required: true, unique: true },
  external_code: String,
  tenant_id: { type: String, required: true },
  customer_type: { type: String, enum: ["business", "private", "reseller"], required: true },
  is_guest: { type: Boolean, default: false },
  email: { type: String, required: true },
  phone: String,
  first_name: String,
  last_name: String,
  company_name: String,
  legal_info: {
    vat_number: String,
    fiscal_code: String,
    pec_email: String,
    sdi_code: String,
  },
  addresses: [AddressSchema],
  default_shipping_address_id: String,
  default_billing_address_id: String,
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const CustomerModel = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema, "customers");

// Counter Schema for cart_number
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
}, { timestamps: false });

const CounterModel = mongoose.models.Counter || mongoose.model("Counter", CounterSchema, "counters");

// Get next cart number atomically
async function getNextCartNumber(year: number): Promise<number> {
  const result = await CounterModel.findOneAndUpdate(
    { _id: `cart_number_${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", new: true }
  );
  return result.value;
}

// Sample products for cart items
const sampleProducts = [
  { entity_code: "PROD-001", sku: "SKU-001", name: "Premium Widget A", list_price: 25.00, unit_price: 20.00, vat_rate: 22, brand: "WidgetCo", category: "Widgets" },
  { entity_code: "PROD-002", sku: "SKU-002", name: "Deluxe Gadget B", list_price: 150.00, unit_price: 120.00, vat_rate: 22, brand: "GadgetPro", category: "Gadgets" },
  { entity_code: "PROD-003", sku: "SKU-003", name: "Standard Component C", list_price: 8.50, unit_price: 7.00, vat_rate: 10, brand: "ComponentMax", category: "Components" },
];

function calculateLineItem(product: typeof sampleProducts[0], quantity: number, lineNumber: number, promoCode?: string, promoRow?: number) {
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
    promo_code: promoCode,
    promo_row: promoRow,
    raw_data: { seeded: true, timestamp: new Date().toISOString() },
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

async function seedCarts() {
  const { customerCode, tenantId, clear, clearAll } = parseArgs();

  const mongoUrl = process.env.VINC_MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error("VINC_MONGO_URL or MONGODB_URI not set");
    process.exit(1);
  }

  // Use same database name as the application: vinc-{tenant_id}
  const dbName = `vinc-${tenantId}`;

  console.log("Connecting to MongoDB...");
  console.log(`Database: ${dbName}`);
  await mongoose.connect(mongoUrl, { dbName });
  console.log("Connected\n");

  console.log(`Configuration:`);
  console.log(`  Customer Code: ${customerCode}`);
  console.log(`  Tenant ID:     ${tenantId}`);
  console.log(`  Clear:         ${clear}`);
  console.log(`  Clear All:     ${clearAll}\n`);

  // Clear ALL orders and customers if requested
  if (clearAll) {
    console.log("Clearing ALL orders and customers...");
    const ordersResult = await OrderModel.deleteMany({});
    console.log(`  Deleted ${ordersResult.deletedCount} orders`);
    const customersResult = await CustomerModel.deleteMany({});
    console.log(`  Deleted ${customersResult.deletedCount} customers\n`);
  } else if (clear) {
    // Clear existing carts only for this customer
    const result = await OrderModel.deleteMany({ customer_code: customerCode, status: "draft" });
    console.log(`Deleted ${result.deletedCount} existing draft orders\n`);
  }

  const year = new Date().getFullYear();
  const customerId = `cust_${nanoid(8)}`;

  // Create test customer with addresses
  console.log("Creating test customer with addresses...");
  const testCustomer = await CustomerModel.create({
    customer_id: customerId,
    external_code: customerCode,
    tenant_id: tenantId,
    customer_type: "business",
    is_guest: false,
    email: `${customerCode.toLowerCase()}@test.example.com`,
    phone: "+39 02 1234567",
    company_name: "Test Company Srl",
    legal_info: {
      vat_number: "IT12345678901",
      fiscal_code: "12345678901",
      pec_email: "testcompany@pec.it",
      sdi_code: "ABC1234",
    },
    addresses: [
      {
        address_id: `addr_${nanoid(8)}`,
        external_code: "ADDR-001",
        address_type: "both",
        label: "Sede Principale",
        is_default: true,
        recipient_name: "Test Company Srl",
        street_address: "Via Roma 1",
        city: "Milano",
        province: "MI",
        postal_code: "20100",
        country: "IT",
        phone: "+39 02 1234567",
      },
      {
        address_id: `addr_${nanoid(8)}`,
        external_code: "ADDR-002",
        address_type: "delivery",
        label: "Magazzino Nord",
        is_default: false,
        recipient_name: "Test Company - Magazzino",
        street_address: "Via Logistica 10",
        city: "Bergamo",
        province: "BG",
        postal_code: "24100",
        country: "IT",
        phone: "+39 035 9876543",
        delivery_notes: "Consegna ore 8-12",
      },
      {
        address_id: `addr_${nanoid(8)}`,
        external_code: "ADDR-003",
        address_type: "delivery",
        label: "Filiale Sud",
        is_default: false,
        recipient_name: "Test Company - Filiale",
        street_address: "Via Napoli 50",
        city: "Roma",
        province: "RM",
        postal_code: "00100",
        country: "IT",
      },
    ],
  });

  console.log(`  Created customer: ${testCustomer.customer_id} (${testCustomer.external_code})`);
  console.log(`  Addresses: ${testCustomer.addresses.length}`);
  for (const addr of testCustomer.addresses) {
    console.log(`    - ${addr.external_code}: ${addr.label} (${addr.city})`);
  }

  console.log("");

  // Helper to get address_id by external_code
  const getAddressId = (externalCode: string) => {
    const addr = testCustomer.addresses.find((a: { external_code?: string }) => a.external_code === externalCode);
    return addr?.address_id || `addr_${nanoid(8)}`;
  };

  // Test scenarios for cart with is_current
  const cartsToCreate = [
    // Address 1 - Current cart (is_current: true)
    {
      addressCode: "ADDR-001",
      addressId: getAddressId("ADDR-001"),
      is_current: true,
      items: [
        calculateLineItem(sampleProducts[0], 10, 10, "PROMO-A", 1),
        calculateLineItem(sampleProducts[1], 2, 20),
      ],
      notes: "Current working cart for Address 1",
      pricelist_type: "VEND",
      pricelist_code: "02",
    },
    // Address 1 - Saved draft (is_current: false)
    {
      addressCode: "ADDR-001",
      addressId: getAddressId("ADDR-001"),
      is_current: false,
      items: [
        calculateLineItem(sampleProducts[2], 50, 10),
      ],
      notes: "Saved draft cart for Address 1",
      pricelist_type: "VEND",
      pricelist_code: "02",
    },
    // Address 2 - Current cart (is_current: true)
    {
      addressCode: "ADDR-002",
      addressId: getAddressId("ADDR-002"),
      is_current: true,
      items: [
        calculateLineItem(sampleProducts[0], 5, 10, "PROMO-B", 2),
        calculateLineItem(sampleProducts[1], 3, 20, "PROMO-B", 3),
        calculateLineItem(sampleProducts[2], 100, 30),
      ],
      notes: "Current working cart for Address 2",
      pricelist_type: "CONS",
      pricelist_code: "01",
    },
    // Address 2 - Another saved draft (is_current: false)
    {
      addressCode: "ADDR-002",
      addressId: getAddressId("ADDR-002"),
      is_current: false,
      items: [
        calculateLineItem(sampleProducts[1], 1, 10),
      ],
      notes: "Another saved draft cart for Address 2",
      pricelist_type: "CONS",
      pricelist_code: "01",
    },
    // Address 3 - Only current cart (no drafts)
    {
      addressCode: "ADDR-003",
      addressId: getAddressId("ADDR-003"),
      is_current: true,
      items: [
        calculateLineItem(sampleProducts[0], 20, 10),
      ],
      notes: "Current cart for Address 3 (no drafts)",
      pricelist_type: "VEND",
      pricelist_code: "03",
    },
  ];

  console.log(`Creating ${cartsToCreate.length} test carts...\n`);

  for (let i = 0; i < cartsToCreate.length; i++) {
    const cartData = cartsToCreate[i];
    const totals = calculateOrderTotals(cartData.items);
    const order_id = nanoid(12);
    const cart_number = await getNextCartNumber(year);

    const cart = await OrderModel.create({
      order_id,
      cart_number,
      year,
      status: "draft",
      is_current: cartData.is_current,
      tenant_id: tenantId,
      customer_id: testCustomer.customer_id,
      customer_code: customerCode,
      shipping_address_id: cartData.addressId,
      shipping_address_code: cartData.addressCode,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      pricelist_type: cartData.pricelist_type,
      pricelist_code: cartData.pricelist_code,
      ...totals,
      shipping_cost: 0,
      notes: cartData.notes,
      session_id: `sess_${nanoid(16)}`,
      flow_id: `flow_${nanoid(16)}`,
      source: "seed",
      items: cartData.items,
    });

    const currentLabel = cartData.is_current ? "[CURRENT]" : "[DRAFT]  ";
    console.log(
      `${currentLabel} | Cart #${cart.cart_number}/${year} | ${cart.order_id} | ${cartData.addressCode} | ${cart.items.length} items | EUR ${cart.order_total.toFixed(2)}`
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test carts created successfully!");
  console.log("=".repeat(60));

  // Summary by address
  console.log("\nSummary by address:");
  const addressSummary = await OrderModel.aggregate([
    { $match: { customer_code: customerCode, status: "draft" } },
    { $group: {
      _id: "$shipping_address_code",
      total: { $sum: 1 },
      current: { $sum: { $cond: ["$is_current", 1, 0] } },
      drafts: { $sum: { $cond: ["$is_current", 0, 1] } }
    }},
    { $sort: { _id: 1 } }
  ]);

  for (const addr of addressSummary) {
    console.log(`  ${addr._id}: ${addr.current} current, ${addr.drafts} drafts (total: ${addr.total})`);
  }

  console.log("\nTest scenarios:");
  console.log("  1. GET /api/b2b/cart/active with customer_code=TEST-001, address_code=ADDR-001");
  console.log("     -> Should return the current cart for ADDR-001");
  console.log("  2. GET /api/b2b/cart/active with customer_code=TEST-001, address_code=ADDR-002");
  console.log("     -> Should return the current cart for ADDR-002");
  console.log("  3. GET /api/b2b/cart/active with customer_code=TEST-001, address_code=ADDR-004");
  console.log("     -> Should create a new current cart for ADDR-004 (if customer/address details provided)");

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB");
}

seedCarts().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
