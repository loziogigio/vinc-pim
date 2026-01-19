/**
 * Seed Store Data
 *
 * Creates 30 orders with auto-generated customers, addresses, and line items.
 * Mix of business, private, reseller, and guest customers.
 *
 * Run: npx tsx scripts/seed-store-data.ts
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { config } from "dotenv";

config({ path: ".env" });

// ============================================
// SCHEMAS (inline to avoid import issues)
// ============================================

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
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const LegalInfoSchema = new mongoose.Schema({
  vat_number: String,
  fiscal_code: String,
  pec_email: String,
  sdi_code: String,
}, { _id: false });

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
  legal_info: LegalInfoSchema,
  addresses: [AddressSchema],
  default_shipping_address_id: String,
  default_billing_address_id: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const DiscountTierSchema = new mongoose.Schema({
  tier: { type: Number, required: true },
  type: { type: String, enum: ["percentage", "fixed", "override"], required: true },
  value: { type: Number, required: true },
  reason: String,
}, { _id: false });

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
  discounts: [DiscountTierSchema],
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
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  order_number: Number,
  year: { type: Number, required: true },
  status: { type: String, enum: ["draft", "pending", "confirmed", "shipped", "cancelled"], default: "draft" },
  customer_id: { type: String, required: true },
  customer_code: String,
  shipping_address_id: String,
  billing_address_id: String,
  requested_delivery_date: Date,
  delivery_slot: String,
  delivery_route: String,
  shipping_method: { type: String, default: "courier" },
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
  confirmed_at: Date,
  session_id: String,
  flow_id: String,
  source: { type: String, default: "web" },
  items: [LineItemSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

// ============================================
// DATA GENERATORS
// ============================================

const TENANT_ID = process.env.VINC_TENANT_ID || "demo";

const italianCities = [
  { city: "Milano", province: "MI", postal_code: "20100" },
  { city: "Roma", province: "RM", postal_code: "00100" },
  { city: "Torino", province: "TO", postal_code: "10100" },
  { city: "Napoli", province: "NA", postal_code: "80100" },
  { city: "Firenze", province: "FI", postal_code: "50100" },
  { city: "Bologna", province: "BO", postal_code: "40100" },
  { city: "Genova", province: "GE", postal_code: "16100" },
  { city: "Palermo", province: "PA", postal_code: "90100" },
  { city: "Bari", province: "BA", postal_code: "70100" },
  { city: "Venezia", province: "VE", postal_code: "30100" },
];

const companyNames = [
  "Acme Srl", "Beta SpA", "Gamma Trading", "Delta Industries", "Epsilon Tech",
  "Zeta Solutions", "Eta Consulting", "Theta Manufacturing", "Iota Services", "Kappa Group",
  "Lambda Logistics", "Mu Retail", "Nu Wholesale", "Xi Distribution", "Omicron Foods",
];

const firstNames = ["Marco", "Luca", "Giuseppe", "Giovanni", "Francesco", "Andrea", "Alessandro", "Matteo", "Lorenzo", "Davide", "Maria", "Anna", "Giulia", "Francesca", "Sara"];
const lastNames = ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"];

const streetNames = ["Via Roma", "Via Milano", "Via Garibaldi", "Via Dante", "Via Manzoni", "Corso Italia", "Via Verdi", "Via Leopardi", "Via Carducci", "Via Pascoli"];

const products = [
  { entity_code: "PROD-001", sku: "SKU-001", name: "Widget A", list_price: 25.00, brand: "BrandX", category: "Widgets" },
  { entity_code: "PROD-002", sku: "SKU-002", name: "Widget B", list_price: 35.00, brand: "BrandX", category: "Widgets" },
  { entity_code: "PROD-003", sku: "SKU-003", name: "Gadget Pro", list_price: 150.00, brand: "TechCo", category: "Gadgets" },
  { entity_code: "PROD-004", sku: "SKU-004", name: "Tool Basic", list_price: 45.00, brand: "ToolMaster", category: "Tools" },
  { entity_code: "PROD-005", sku: "SKU-005", name: "Tool Advanced", list_price: 89.00, brand: "ToolMaster", category: "Tools" },
  { entity_code: "PROD-006", sku: "SKU-006", name: "Component X", list_price: 12.50, brand: "PartsCo", category: "Components" },
  { entity_code: "PROD-007", sku: "SKU-007", name: "Component Y", list_price: 8.75, brand: "PartsCo", category: "Components" },
  { entity_code: "PROD-008", sku: "SKU-008", name: "Supply Kit", list_price: 65.00, brand: "SupplyHub", category: "Supplies" },
  { entity_code: "PROD-009", sku: "SKU-009", name: "Premium Pack", list_price: 199.00, brand: "PremiumBrand", category: "Bundles" },
  { entity_code: "PROD-010", sku: "SKU-010", name: "Starter Set", list_price: 49.00, brand: "StarterCo", category: "Bundles" },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateVatNumber(): string {
  return `IT${String(randomInt(10000000000, 99999999999))}`;
}

function generateFiscalCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += letters[randomInt(0, 25)];
  code += String(randomInt(10, 99));
  code += letters[randomInt(0, 25)];
  code += String(randomInt(10, 99));
  code += letters[randomInt(0, 25)];
  code += String(randomInt(100, 999));
  code += letters[randomInt(0, 25)];
  return code;
}

function generateSdiCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 7; i++) code += chars[randomInt(0, chars.length - 1)];
  return code;
}

function generateAddress(isDefault: boolean = false, type: "delivery" | "billing" | "both" = "both") {
  const location = randomElement(italianCities);
  return {
    address_id: nanoid(8),
    address_type: type,
    label: type === "delivery" ? "Magazzino" : type === "billing" ? "Sede Legale" : "Sede Principale",
    is_default: isDefault,
    recipient_name: randomElement(companyNames),
    street_address: `${randomElement(streetNames)} ${randomInt(1, 200)}`,
    city: location.city,
    province: location.province,
    postal_code: location.postal_code,
    country: "IT",
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function generateBusinessCustomer() {
  const companyName = randomElement(companyNames);
  const address = generateAddress(true, "both");
  const customer_id = nanoid(12);

  return {
    customer_id,
    external_code: `CLI-${randomInt(1000, 9999)}`,
    tenant_id: TENANT_ID,
    customer_type: "business" as const,
    is_guest: false,
    email: `info@${companyName.toLowerCase().replace(/\s+/g, "")}.it`,
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
    company_name: companyName,
    legal_info: {
      vat_number: generateVatNumber(),
      fiscal_code: generateVatNumber().replace("IT", ""),
      pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
      sdi_code: generateSdiCode(),
    },
    addresses: [address],
    default_shipping_address_id: address.address_id,
    default_billing_address_id: address.address_id,
  };
}

function generatePrivateCustomer(isGuest: boolean = false) {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);
  const address = generateAddress(true, "both");
  const customer_id = nanoid(12);

  return {
    customer_id,
    tenant_id: TENANT_ID,
    customer_type: "private" as const,
    is_guest: isGuest,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@email.it`,
    phone: `+39 3${randomInt(20, 99)} ${randomInt(1000000, 9999999)}`,
    first_name: firstName,
    last_name: lastName,
    legal_info: {
      fiscal_code: generateFiscalCode(),
    },
    addresses: [address],
    default_shipping_address_id: address.address_id,
    default_billing_address_id: address.address_id,
  };
}

function generateResellerCustomer() {
  const companyName = `${randomElement(lastNames)} Distribuzione`;
  const address = generateAddress(true, "both");
  const customer_id = nanoid(12);

  return {
    customer_id,
    external_code: `RES-${randomInt(100, 999)}`,
    tenant_id: TENANT_ID,
    customer_type: "reseller" as const,
    is_guest: false,
    email: `ordini@${companyName.toLowerCase().replace(/\s+/g, "")}.it`,
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
    company_name: companyName,
    legal_info: {
      vat_number: generateVatNumber(),
      pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
      sdi_code: generateSdiCode(),
    },
    addresses: [address],
    default_shipping_address_id: address.address_id,
    default_billing_address_id: address.address_id,
  };
}

function generateLineItems(count: number) {
  const items = [];
  const usedProducts = new Set<string>();

  for (let i = 0; i < count; i++) {
    let product = randomElement(products);
    while (usedProducts.has(product.entity_code)) {
      product = randomElement(products);
    }
    usedProducts.add(product.entity_code);

    const quantity = randomInt(1, 20);
    const discountPercent = randomElement([0, 0, 0, 10, 15, 20, 25]);
    const unit_price = +(product.list_price * (1 - discountPercent / 100)).toFixed(2);

    const line_gross = +(quantity * product.list_price).toFixed(2);
    const line_net = +(quantity * unit_price).toFixed(2);
    const vat_rate = 22;
    const line_vat = +(line_net * vat_rate / 100).toFixed(2);
    const line_total = +(line_net + line_vat).toFixed(2);

    items.push({
      line_number: (i + 1) * 10,
      entity_code: product.entity_code,
      sku: product.sku,
      quantity,
      list_price: product.list_price,
      unit_price,
      vat_rate,
      line_gross,
      line_net,
      line_vat,
      line_total,
      discounts: discountPercent > 0 ? [{
        tier: 1,
        type: "percentage" as const,
        value: -discountPercent,
        reason: "customer_discount",
      }] : [],
      total_discount_percent: discountPercent,
      name: product.name,
      brand: product.brand,
      category: product.category,
      added_at: new Date(),
      updated_at: new Date(),
      added_from: randomElement(["pdp", "plp", "search", "quick_order"]),
      added_via: randomElement(["main_cta", "row_action", "carousel"]),
    });
  }

  return items;
}

function generateOrder(customer: any, status: string, orderNumber: number | null = null) {
  const items = generateLineItems(randomInt(1, 5));

  const subtotal_gross = items.reduce((sum, i) => sum + i.line_gross, 0);
  const subtotal_net = items.reduce((sum, i) => sum + i.line_net, 0);
  const total_vat = items.reduce((sum, i) => sum + i.line_vat, 0);
  const total_discount = subtotal_gross - subtotal_net;
  const shipping_cost = status === "draft" ? 0 : randomElement([0, 5.90, 9.90, 12.90]);
  const order_total = subtotal_net + total_vat + shipping_cost;

  const daysAgo = randomInt(0, 30);
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);

  return {
    order_id: nanoid(12),
    order_number: orderNumber,
    year: 2025,
    status,
    customer_id: customer.customer_id,
    customer_code: customer.external_code,
    shipping_address_id: status !== "draft" ? customer.default_shipping_address_id : null,
    billing_address_id: status !== "draft" ? customer.default_billing_address_id : null,
    requested_delivery_date: status !== "draft" ? new Date(Date.now() + randomInt(1, 14) * 24 * 60 * 60 * 1000) : null,
    shipping_method: "courier",
    price_list_id: "default",
    price_list_type: customer.customer_type === "reseller" ? "reseller" : "wholesale",
    order_type: "b2b",
    currency: "EUR",
    subtotal_gross: +subtotal_gross.toFixed(2),
    subtotal_net: +subtotal_net.toFixed(2),
    total_discount: +total_discount.toFixed(2),
    total_vat: +total_vat.toFixed(2),
    shipping_cost,
    order_total: +order_total.toFixed(2),
    po_reference: status !== "draft" ? `PO-${randomInt(1000, 9999)}` : null,
    notes: randomElement([null, null, "Consegna al mattino", "Chiamare prima della consegna"]),
    confirmed_at: ["confirmed", "shipped"].includes(status) ? createdAt : null,
    session_id: nanoid(16),
    flow_id: nanoid(16),
    source: "web",
    items,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("VINC_MONGO_URL not set");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);
  console.log("Connected!\n");

  const CustomerModel = mongoose.model("Customer", CustomerSchema, "customers");
  const OrderModel = mongoose.model("Order", OrderSchema, "orders");

  // Clear existing data (optional)
  console.log("Clearing existing customers and orders...");
  await CustomerModel.deleteMany({ tenant_id: TENANT_ID });
  await OrderModel.deleteMany({ year: 2025 });

  // Generate customers
  console.log("\nGenerating customers...");
  const customers = [];

  // 8 business customers
  for (let i = 0; i < 8; i++) {
    customers.push(generateBusinessCustomer());
  }

  // 6 private customers (registered)
  for (let i = 0; i < 6; i++) {
    customers.push(generatePrivateCustomer(false));
  }

  // 4 guest customers
  for (let i = 0; i < 4; i++) {
    customers.push(generatePrivateCustomer(true));
  }

  // 2 reseller customers
  for (let i = 0; i < 2; i++) {
    customers.push(generateResellerCustomer());
  }

  await CustomerModel.insertMany(customers);
  console.log(`Created ${customers.length} customers:`);
  console.log(`  - 8 business`);
  console.log(`  - 6 private (registered)`);
  console.log(`  - 4 private (guest)`);
  console.log(`  - 2 reseller`);

  // Generate 30 orders with various statuses
  console.log("\nGenerating 30 orders...");
  const orders = [];
  const statusDistribution = [
    ...Array(6).fill("draft"),      // 6 carts
    ...Array(5).fill("pending"),    // 5 pending
    ...Array(10).fill("confirmed"), // 10 confirmed
    ...Array(6).fill("shipped"),    // 6 shipped
    ...Array(3).fill("cancelled"),  // 3 cancelled
  ];

  let orderNumber = 1;
  for (let i = 0; i < 30; i++) {
    const customer = randomElement(customers);
    const status = statusDistribution[i];
    const order = generateOrder(
      customer,
      status,
      status !== "draft" ? orderNumber++ : null
    );
    orders.push(order);
  }

  await OrderModel.insertMany(orders);

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`Created ${orders.length} orders:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  - ${count} ${status}`);
  });

  // Summary
  const totalValue = orders.reduce((sum, o) => sum + o.order_total, 0);
  console.log(`\nTotal order value: EUR ${totalValue.toFixed(2)}`);

  await mongoose.disconnect();
  console.log("\nDone!");
}

main().catch(console.error);
