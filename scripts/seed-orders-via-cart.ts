/**
 * Seed Orders via Cart Workflow
 *
 * Creates 10 orders by:
 * 1. Getting or creating a cart for each customer
 * 2. Adding random items (with some promotions)
 * 3. Converting carts to orders
 */

import "dotenv/config";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

const mongoUrl = process.env.VINC_MONGO_URL || process.env.MONGODB_URI;
const tenantId = process.env.VINC_TENANT_ID || "hidros-it";
const dbName = `vinc-${tenantId}`;

// Sample products catalog
const PRODUCTS = [
  {
    entity_code: "HYD-PUMP-001",
    sku: "HP001",
    name: "Hydraulic Pump 50L/min",
    list_price: 450.0,
    unit_price: 380.0,
    vat_rate: 22,
    brand: "HydroMax",
    category: "Pumps",
  },
  {
    entity_code: "HYD-VALVE-002",
    sku: "HV002",
    name: "Directional Control Valve 4/3",
    list_price: 280.0,
    unit_price: 240.0,
    vat_rate: 22,
    brand: "ValveTech",
    category: "Valves",
  },
  {
    entity_code: "HYD-CYL-003",
    sku: "HC003",
    name: "Double Acting Cylinder 100mm",
    list_price: 320.0,
    unit_price: 275.0,
    vat_rate: 22,
    brand: "CylinderPro",
    category: "Cylinders",
  },
  {
    entity_code: "HYD-HOSE-004",
    sku: "HH004",
    name: "High Pressure Hose 10m",
    list_price: 85.0,
    unit_price: 72.0,
    vat_rate: 22,
    brand: "HoseFlex",
    category: "Hoses",
  },
  {
    entity_code: "HYD-FILTER-005",
    sku: "HF005",
    name: "Return Line Filter 25μm",
    list_price: 95.0,
    unit_price: 82.0,
    vat_rate: 22,
    brand: "FilterMax",
    category: "Filters",
  },
  {
    entity_code: "HYD-OIL-006",
    sku: "HO006",
    name: "Hydraulic Oil ISO 46 20L",
    list_price: 65.0,
    unit_price: 55.0,
    vat_rate: 22,
    brand: "LubriTech",
    category: "Oils",
  },
  {
    entity_code: "HYD-CONN-007",
    sku: "HC007",
    name: "Quick Connect Coupling Set",
    list_price: 45.0,
    unit_price: 38.0,
    vat_rate: 22,
    brand: "ConnectFast",
    category: "Connectors",
  },
  {
    entity_code: "HYD-SEAL-008",
    sku: "HS008",
    name: "Seal Kit Universal",
    list_price: 35.0,
    unit_price: 28.0,
    vat_rate: 22,
    brand: "SealPro",
    category: "Seals",
  },
];

// Promotional items (gift with purchase)
const PROMO_ITEMS = [
  {
    entity_code: "PROMO-CAP-001",
    sku: "PCAP001",
    name: "Branded Cap - FREE",
    list_price: 0,
    unit_price: 0,
    vat_rate: 22,
    brand: "HydroMax",
    category: "Promotions",
    is_gift: true,
    promo_code: "SUMMER2025",
  },
  {
    entity_code: "PROMO-GLOVES-002",
    sku: "PGL002",
    name: "Work Gloves - FREE",
    list_price: 0,
    unit_price: 0,
    vat_rate: 22,
    brand: "SafetyFirst",
    category: "Promotions",
    is_gift: true,
    promo_code: "NEWCUSTOMER",
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateLineTotals(
  quantity: number,
  listPrice: number,
  unitPrice: number,
  vatRate: number
) {
  const line_gross = Math.round(quantity * listPrice * 100) / 100;
  const line_net = Math.round(quantity * unitPrice * 100) / 100;
  const line_vat = Math.round(line_net * (vatRate / 100) * 100) / 100;
  const line_total = Math.round((line_net + line_vat) * 100) / 100;
  return { line_gross, line_net, line_vat, line_total };
}

function calculateOrderTotals(items: any[]) {
  const subtotal_gross = Math.round(
    items.reduce((sum, item) => sum + item.line_gross, 0) * 100
  ) / 100;
  const subtotal_net = Math.round(
    items.reduce((sum, item) => sum + item.line_net, 0) * 100
  ) / 100;
  const total_vat = Math.round(
    items.reduce((sum, item) => sum + item.line_vat, 0) * 100
  ) / 100;
  const total_discount = Math.round(
    items.reduce((sum, item) => sum + item.line_gross - item.line_net, 0) * 100
  ) / 100;
  const order_total = Math.round(
    items.reduce((sum, item) => sum + item.line_total, 0) * 100
  ) / 100;

  return { subtotal_gross, subtotal_net, total_vat, total_discount, order_total };
}

async function main() {
  console.log("============================================================");
  console.log("Seeding Orders via Cart Workflow");
  console.log("============================================================\n");

  if (!mongoUrl) {
    console.error("Error: VINC_MONGO_URL or MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, { dbName });
  console.log(`Connected to database: ${dbName}\n`);

  const db = mongoose.connection.db!;
  const customersCol = db.collection("customers");
  const ordersCol = db.collection("orders");
  const countersCol = db.collection("counters");

  // Get existing customers
  const customers = await customersCol.find({}).toArray();

  if (customers.length === 0) {
    console.log("No customers found. Please create customers first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found ${customers.length} customers\n`);

  const year = new Date().getFullYear();
  const createdOrders: any[] = [];

  // Create 10 orders (distribute among customers)
  for (let orderIndex = 0; orderIndex < 10; orderIndex++) {
    const customer = customers[orderIndex % customers.length];
    const customerName = customer.company_name || `${customer.first_name} ${customer.last_name}`;

    console.log(`\n--- Order ${orderIndex + 1}/10 for ${customerName} (${customer.public_code}) ---`);

    // Step 1: Create cart (draft order)
    const cart_id = nanoid(12);
    const session_id = `sess_${nanoid(16)}`;
    const flow_id = `flow_${nanoid(16)}`;

    // Get next cart number
    const cartCounterResult = await countersCol.findOneAndUpdate(
      { _id: `cart_number_${year}` },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const cart_number = cartCounterResult?.value || 1;

    console.log(`  1. Creating cart ${cart_id} (Cart #${cart_number})`);

    // Create empty cart
    const cartDoc = {
      order_id: cart_id,
      cart_number,
      year,
      status: "draft",
      is_current: true,
      tenant_id: tenantId,
      customer_id: customer.customer_id,
      customer_code: customer.external_code,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      shipping_cost: 0,
      order_total: 0,
      session_id,
      flow_id,
      source: "api",
      items: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    await ordersCol.insertOne(cartDoc);

    // Step 2: Add random items to cart
    const itemCount = randomInt(2, 5);
    const items: any[] = [];
    const usedProducts = new Set<string>();

    console.log(`  2. Adding ${itemCount} items to cart:`);

    for (let i = 0; i < itemCount; i++) {
      // Pick a random product (avoid duplicates)
      let product;
      do {
        product = randomChoice(PRODUCTS);
      } while (usedProducts.has(product.entity_code) && usedProducts.size < PRODUCTS.length);
      usedProducts.add(product.entity_code);

      const quantity = randomInt(1, 10) * 5; // 5, 10, 15, ..., 50
      const totals = calculateLineTotals(
        quantity,
        product.list_price,
        product.unit_price,
        product.vat_rate
      );

      const lineItem = {
        line_number: (i + 1) * 10,
        entity_code: product.entity_code,
        sku: product.sku,
        name: product.name,
        quantity,
        quantity_unit: "pz",
        list_price: product.list_price,
        unit_price: product.unit_price,
        vat_rate: product.vat_rate,
        ...totals,
        brand: product.brand,
        category: product.category,
        discounts: [],
        total_discount_percent: Math.round(
          ((product.list_price - product.unit_price) / product.list_price) * 100
        ),
        is_gift_line: false,
        added_at: new Date(),
        updated_at: new Date(),
        added_from: "cart",
        added_via: "api",
      };

      items.push(lineItem);
      console.log(`     - ${product.name} x${quantity} = ${totals.line_total.toFixed(2)}`);

      // Update cart with new item
      await ordersCol.updateOne(
        { order_id: cart_id },
        { $push: { items: lineItem } as any }
      );
    }

    // Step 3: Maybe add a promotional item (30% chance)
    if (Math.random() < 0.3) {
      const promo = randomChoice(PROMO_ITEMS);
      const promoItem = {
        line_number: (itemCount + 1) * 10,
        entity_code: promo.entity_code,
        sku: promo.sku,
        name: promo.name,
        quantity: 1,
        quantity_unit: "pz",
        list_price: 0,
        unit_price: 0,
        promo_price: 0,
        vat_rate: promo.vat_rate,
        line_gross: 0,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
        brand: promo.brand,
        category: promo.category,
        discounts: [],
        total_discount_percent: 100,
        is_gift_line: true,
        promo_code: promo.promo_code,
        promo_row: true,
        added_at: new Date(),
        updated_at: new Date(),
        added_from: "promo",
        added_via: "system",
      };

      items.push(promoItem);
      console.log(`     - [PROMO] ${promo.name} (${promo.promo_code})`);

      await ordersCol.updateOne(
        { order_id: cart_id },
        { $push: { items: promoItem } as any }
      );
    }

    // Step 4: Update cart totals
    const orderTotals = calculateOrderTotals(items);
    await ordersCol.updateOne(
      { order_id: cart_id },
      {
        $set: {
          ...orderTotals,
          updated_at: new Date(),
        },
      }
    );

    console.log(`     Total: ${orderTotals.order_total.toFixed(2)}`);

    // Step 5: Convert cart to order (change status)
    const finalStatus = randomChoice(["pending", "confirmed", "shipped"]);
    let order_number: number | undefined;

    if (finalStatus === "confirmed" || finalStatus === "shipped") {
      // Get next order number
      const orderCounterResult = await countersCol.findOneAndUpdate(
        { _id: `order_number_${year}` },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      order_number = orderCounterResult?.value;
    }

    const po_reference = `PO-${year}-${orderIndex + 1}`;

    await ordersCol.updateOne(
      { order_id: cart_id },
      {
        $set: {
          status: finalStatus,
          is_current: false,
          order_number,
          po_reference,
          updated_at: new Date(),
        },
      }
    );

    console.log(`  3. Converted to order: status=${finalStatus}${order_number ? `, #${order_number}` : ""}`);

    createdOrders.push({
      order_id: cart_id,
      customer: customerName,
      public_code: customer.public_code,
      items: items.length,
      total: orderTotals.order_total,
      status: finalStatus,
      order_number,
    });
  }

  console.log("\n============================================================");
  console.log("Summary");
  console.log("============================================================\n");

  console.log("Created Orders:");
  console.table(
    createdOrders.map((o) => ({
      Order: o.order_id,
      Customer: o.public_code,
      Items: o.items,
      Total: `${o.total.toFixed(2)}`,
      Status: o.status,
      "#": o.order_number || "-",
    }))
  );

  const totalValue = createdOrders.reduce((sum, o) => sum + o.total, 0);
  console.log(`\nTotal Orders: ${createdOrders.length}`);
  console.log(`Total Value: ${totalValue.toFixed(2)}`);

  await mongoose.disconnect();
  console.log("\nDone!");
}

main().catch(console.error);
