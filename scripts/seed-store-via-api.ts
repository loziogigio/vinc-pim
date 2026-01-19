/**
 * Seed Store Data via API
 *
 * Creates 30 orders with auto-generated customers via API endpoints.
 * Run: npx tsx scripts/seed-store-via-api.ts
 */

import { nanoid } from "nanoid";

const API_BASE = process.env.API_URL || "http://localhost:3000";

// ============================================
// DATA GENERATORS
// ============================================

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

function generateAddress(type: "delivery" | "billing" | "both" = "both") {
  const location = randomElement(italianCities);
  return {
    address_type: type,
    label: type === "delivery" ? "Magazzino" : type === "billing" ? "Sede Legale" : "Sede Principale",
    is_default: true,
    recipient_name: randomElement(companyNames),
    street_address: `${randomElement(streetNames)} ${randomInt(1, 200)}`,
    city: location.city,
    province: location.province,
    postal_code: location.postal_code,
    country: "IT",
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
  };
}

function generateBusinessCustomer() {
  const companyName = randomElement(companyNames);
  return {
    customer_type: "business",
    is_guest: false,
    email: `info@${companyName.toLowerCase().replace(/\s+/g, "")}${randomInt(1, 99)}.it`,
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
    company_name: companyName,
    external_code: `CLI-${randomInt(1000, 9999)}`,
    legal_info: {
      vat_number: generateVatNumber(),
      fiscal_code: generateVatNumber().replace("IT", ""),
      pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
      sdi_code: generateSdiCode(),
    },
    addresses: [generateAddress("both")],
  };
}

function generatePrivateCustomer(isGuest: boolean = false) {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);
  return {
    customer_type: "private",
    is_guest: isGuest,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@email.it`,
    phone: `+39 3${randomInt(20, 99)} ${randomInt(1000000, 9999999)}`,
    first_name: firstName,
    last_name: lastName,
    legal_info: {
      fiscal_code: generateFiscalCode(),
    },
    addresses: [generateAddress("both")],
  };
}

function generateResellerCustomer() {
  const companyName = `${randomElement(lastNames)} Distribuzione`;
  return {
    customer_type: "reseller",
    is_guest: false,
    email: `ordini@${companyName.toLowerCase().replace(/\s+/g, "")}${randomInt(1, 99)}.it`,
    phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
    company_name: companyName,
    external_code: `RES-${randomInt(100, 999)}`,
    legal_info: {
      vat_number: generateVatNumber(),
      pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
      sdi_code: generateSdiCode(),
    },
    addresses: [generateAddress("both")],
  };
}

function generateLineItem() {
  const product = randomElement(products);
  const quantity = randomInt(1, 20);
  const discountPercent = randomElement([0, 0, 0, 10, 15, 20, 25]);
  const unit_price = +(product.list_price * (1 - discountPercent / 100)).toFixed(2);

  return {
    entity_code: product.entity_code,
    sku: product.sku,
    quantity,
    list_price: product.list_price,
    unit_price,
    vat_rate: 22,
    name: product.name,
    brand: product.brand,
    category: product.category,
    added_from: randomElement(["pdp", "plp", "search", "quick_order"]),
    added_via: randomElement(["main_cta", "row_action", "carousel"]),
  };
}

// ============================================
// API CALLS
// ============================================

async function createCustomer(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/b2b/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to create customer: ${err.error}`);
  }

  const result = await res.json();
  return result.customer;
}

async function createOrder(customerId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: customerId,
      price_list_id: "default",
      price_list_type: "wholesale",
      order_type: "b2b",
      currency: "EUR",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to create order: ${err.error}`);
  }

  const result = await res.json();
  return result.order;
}

async function addItemToOrder(orderId: string, item: any): Promise<void> {
  const res = await fetch(`${API_BASE}/api/b2b/orders/${orderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!res.ok) {
    const err = await res.json();
    console.warn(`Failed to add item: ${err.error}`);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log(`Using API: ${API_BASE}\n`);

  // Generate and create customers
  console.log("Creating customers...");
  const customers: any[] = [];

  // 8 business customers
  for (let i = 0; i < 8; i++) {
    try {
      const customer = await createCustomer(generateBusinessCustomer());
      customers.push(customer);
      process.stdout.write("B");
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
    }
  }

  // 6 private customers (registered)
  for (let i = 0; i < 6; i++) {
    try {
      const customer = await createCustomer(generatePrivateCustomer(false));
      customers.push(customer);
      process.stdout.write("P");
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
    }
  }

  // 4 guest customers
  for (let i = 0; i < 4; i++) {
    try {
      const customer = await createCustomer(generatePrivateCustomer(true));
      customers.push(customer);
      process.stdout.write("G");
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
    }
  }

  // 2 reseller customers
  for (let i = 0; i < 2; i++) {
    try {
      const customer = await createCustomer(generateResellerCustomer());
      customers.push(customer);
      process.stdout.write("R");
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
    }
  }

  console.log(`\nCreated ${customers.length} customers`);

  if (customers.length === 0) {
    console.error("No customers created. Check if the API is running.");
    process.exit(1);
  }

  // Generate 30 orders
  console.log("\nCreating 30 orders...");
  let ordersCreated = 0;

  for (let i = 0; i < 30; i++) {
    const customer = randomElement(customers);
    try {
      const order = await createOrder(customer.customer_id);

      // Add 1-5 items to each order
      const itemCount = randomInt(1, 5);
      for (let j = 0; j < itemCount; j++) {
        await addItemToOrder(order.order_id, generateLineItem());
      }

      ordersCreated++;
      process.stdout.write(".");
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
    }
  }

  console.log(`\nCreated ${ordersCreated} orders`);
  console.log("\nDone!");
}

main().catch(console.error);
