/**
 * Seed 15 Orders via API
 *
 * Tests the Orders API with customer lookup-or-create functionality.
 * Run: npx tsx scripts/seed-15-orders-api.ts
 *
 * Options:
 *   --api-url <url>      API base URL (default: http://localhost:3000)
 *   --username <user>    B2B username (default: B2B_USERNAME env or "b2b_admin")
 *   --password <pass>    B2B password (default: B2B_PASSWORD env)
 *   --tenant <id>        Tenant ID (default: VINC_TENANT_ID env or "hidros-it")
 *
 * Environment variables:
 *   API_URL, B2B_USERNAME, B2B_PASSWORD, VINC_TENANT_ID
 */

import { config } from "dotenv";
config({ path: ".env" });

function getArg(name: string, defaultValue?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

const API_BASE = getArg("api-url", process.env.API_URL || "http://localhost:3000")!;
const B2B_USERNAME = getArg("username", process.env.B2B_USERNAME || "b2b_admin")!;
const B2B_PASSWORD = getArg("password", process.env.B2B_PASSWORD);
const TENANT_ID = getArg("tenant", process.env.VINC_TENANT_ID || "hidros-it")!;

let sessionCookie: string | null = null;

// ============================================
// DATA GENERATORS
// ============================================

const italianCities = [
  { city: "Milano", province: "MI", postal_code: "20100" },
  { city: "Roma", province: "RM", postal_code: "00100" },
  { city: "Torino", province: "TO", postal_code: "10100" },
  { city: "Napoli", province: "NA", postal_code: "80100" },
  { city: "Firenze", province: "FI", postal_code: "50100" },
];

const companyNames = [
  "Acme Italia Srl",
  "Beta Technologies SpA",
  "Gamma Trading Srl",
  "Delta Industries SpA",
  "Epsilon Tech Srl",
];

const products = [
  { entity_code: "PROD-001", sku: "SKU-001", name: "Widget Premium", list_price: 25.0, brand: "WidgetCo", category: "Widgets" },
  { entity_code: "PROD-002", sku: "SKU-002", name: "Gadget Pro", list_price: 150.0, brand: "TechCo", category: "Gadgets" },
  { entity_code: "PROD-003", sku: "SKU-003", name: "Component X", list_price: 12.5, brand: "PartsCo", category: "Components" },
  { entity_code: "PROD-004", sku: "SKU-004", name: "Tool Master", list_price: 45.0, brand: "ToolMaster", category: "Tools" },
  { entity_code: "PROD-005", sku: "SKU-005", name: "Supply Kit", list_price: 65.0, brand: "SupplyHub", category: "Supplies" },
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

function generateSdiCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 7 }, () => chars[randomInt(0, chars.length - 1)]).join("");
}

// ============================================
// ORDER SCENARIOS
// ============================================

interface OrderScenario {
  name: string;
  description: string;
  createPayload: () => any;
  items: () => any[];
}

const scenarios: OrderScenario[] = [
  // 1-3: Orders with existing customer_id
  {
    name: "Order with customer_id (scenario 1)",
    description: "Lookup customer by existing ID",
    createPayload: () => ({
      customer_id: "test-customer-001",
    }),
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 10, list_price: 25.0, unit_price: 20.0, vat_rate: 22, name: "Widget Premium" },
    ],
  },
  {
    name: "Order with customer_id (scenario 2)",
    description: "Lookup customer by existing ID",
    createPayload: () => ({
      customer_id: "test-customer-001",
    }),
    items: () => [
      { entity_code: "PROD-002", sku: "SKU-002", quantity: 5, list_price: 150.0, unit_price: 120.0, vat_rate: 22, name: "Gadget Pro" },
      { entity_code: "PROD-003", sku: "SKU-003", quantity: 50, list_price: 12.5, unit_price: 10.0, vat_rate: 10, name: "Component X" },
    ],
  },
  {
    name: "Order with customer_id (scenario 3)",
    description: "Lookup customer by existing ID",
    createPayload: () => ({
      customer_id: "test-customer-002",
    }),
    items: () => [
      { entity_code: "PROD-004", sku: "SKU-004", quantity: 8, list_price: 45.0, unit_price: 38.0, vat_rate: 22, name: "Tool Master" },
    ],
  },

  // 4-6: Orders with inline business customer (creates new or finds by VAT)
  {
    name: "New business customer inline",
    description: "Create customer with full legal_info",
    createPayload: () => {
      const company = randomElement(companyNames);
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "business",
          email: `info@${company.toLowerCase().replace(/\s+/g, "")}.it`,
          company_name: company,
          phone: `+39 02 ${randomInt(1000000, 9999999)}`,
          external_code: `CLI-${randomInt(1000, 9999)}`,
          legal_info: {
            vat_number: vatNumber,
            fiscal_code: vatNumber.replace("IT", ""),
            pec_email: `${company.toLowerCase().replace(/\s+/g, "")}@pec.it`,
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "both",
              label: "Sede Principale",
              is_default: true,
              recipient_name: company,
              street_address: `Via Roma ${randomInt(1, 100)}`,
              city: "Milano",
              province: "MI",
              postal_code: "20100",
              country: "IT",
              phone: `+39 02 ${randomInt(1000000, 9999999)}`,
            },
          ],
        },
      };
    },
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 20, list_price: 25.0, unit_price: 18.0, vat_rate: 22, name: "Widget Premium" },
      { entity_code: "PROD-005", sku: "SKU-005", quantity: 3, list_price: 65.0, unit_price: 55.0, vat_rate: 22, name: "Supply Kit" },
    ],
  },
  {
    name: "New business customer (Torino)",
    description: "Create customer from Torino",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "business",
          email: `ordini@torino-company-${randomInt(1, 99)}.it`,
          company_name: "Torino Industrial Srl",
          legal_info: {
            vat_number: vatNumber,
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "delivery",
              label: "Magazzino",
              recipient_name: "Torino Industrial - Magazzino",
              street_address: "Via Industria 50",
              city: "Torino",
              province: "TO",
              postal_code: "10100",
              country: "IT",
            },
          ],
        },
      };
    },
    items: () => [
      { entity_code: "PROD-003", sku: "SKU-003", quantity: 100, list_price: 12.5, unit_price: 9.0, vat_rate: 10, name: "Component X" },
    ],
  },
  {
    name: "New business customer (Roma)",
    description: "Create customer from Roma",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "business",
          email: `sales@roma-tech-${randomInt(1, 99)}.it`,
          company_name: "Roma Tech Solutions SpA",
          external_code: `CLI-RM-${randomInt(100, 999)}`,
          legal_info: {
            vat_number: vatNumber,
            pec_email: "romatech@pec.it",
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "both",
              label: "Sede Legale",
              is_default: true,
              recipient_name: "Roma Tech Solutions SpA",
              street_address: "Via Tiburtina 200",
              city: "Roma",
              province: "RM",
              postal_code: "00100",
              country: "IT",
              delivery_notes: "Orario consegna: 9-18",
            },
          ],
        },
      };
    },
    items: () => [
      { entity_code: "PROD-002", sku: "SKU-002", quantity: 2, list_price: 150.0, unit_price: 125.0, vat_rate: 22, name: "Gadget Pro" },
    ],
  },

  // 7-9: Orders with private customers
  {
    name: "Private customer (registered)",
    description: "Create registered private customer",
    createPayload: () => ({
      customer: {
        customer_type: "private",
        is_guest: false,
        email: `mario.rossi${randomInt(1, 999)}@gmail.com`,
        first_name: "Mario",
        last_name: "Rossi",
        phone: "+39 333 1234567",
        addresses: [
          {
            address_type: "both",
            recipient_name: "Mario Rossi",
            street_address: "Via Dante 15",
            city: "Firenze",
            province: "FI",
            postal_code: "50100",
            country: "IT",
          },
        ],
      },
    }),
    items: () => [
      { entity_code: "PROD-004", sku: "SKU-004", quantity: 2, list_price: 45.0, unit_price: 40.0, vat_rate: 22, name: "Tool Master" },
    ],
  },
  {
    name: "Private customer (guest)",
    description: "Create guest customer (one-time)",
    createPayload: () => ({
      customer: {
        customer_type: "private",
        is_guest: true,
        email: `guest${randomInt(1, 9999)}@checkout.it`,
        first_name: "Guest",
        last_name: "User",
        addresses: [
          {
            address_type: "both",
            recipient_name: "Guest User",
            street_address: "Via Temporanea 1",
            city: "Napoli",
            province: "NA",
            postal_code: "80100",
            country: "IT",
          },
        ],
      },
    }),
    items: () => [
      { entity_code: "PROD-005", sku: "SKU-005", quantity: 1, list_price: 65.0, unit_price: 65.0, vat_rate: 22, name: "Supply Kit" },
    ],
  },
  {
    name: "Private customer with fiscal code",
    description: "Private customer with Italian fiscal code",
    createPayload: () => ({
      customer: {
        customer_type: "private",
        is_guest: false,
        email: `giulia.bianchi${randomInt(1, 999)}@email.it`,
        first_name: "Giulia",
        last_name: "Bianchi",
        legal_info: {
          fiscal_code: "BNCGLI85A41H501Y",
        },
        addresses: [
          {
            address_type: "both",
            recipient_name: "Giulia Bianchi",
            street_address: "Corso Italia 42",
            city: "Bologna",
            province: "BO",
            postal_code: "40100",
            country: "IT",
          },
        ],
      },
    }),
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 5, list_price: 25.0, unit_price: 22.0, vat_rate: 22, name: "Widget Premium" },
      { entity_code: "PROD-003", sku: "SKU-003", quantity: 10, list_price: 12.5, unit_price: 11.0, vat_rate: 10, name: "Component X" },
    ],
  },

  // 10-12: Orders with reseller customers
  {
    name: "Reseller customer",
    description: "Create reseller with special pricing",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "reseller",
          email: `ordini@distribuzione-nord-${randomInt(1, 99)}.it`,
          company_name: "Distribuzione Nord Srl",
          external_code: `RES-${randomInt(100, 999)}`,
          legal_info: {
            vat_number: vatNumber,
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "delivery",
              label: "Centro Distribuzione",
              recipient_name: "Distribuzione Nord - CD",
              street_address: "Via Logistica 100",
              city: "Milano",
              province: "MI",
              postal_code: "20100",
              country: "IT",
              delivery_notes: "Chiamare 30min prima",
            },
          ],
        },
        price_list_type: "reseller",
      };
    },
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 100, list_price: 25.0, unit_price: 15.0, vat_rate: 22, name: "Widget Premium" },
      { entity_code: "PROD-002", sku: "SKU-002", quantity: 20, list_price: 150.0, unit_price: 90.0, vat_rate: 22, name: "Gadget Pro" },
      { entity_code: "PROD-003", sku: "SKU-003", quantity: 200, list_price: 12.5, unit_price: 7.0, vat_rate: 10, name: "Component X" },
    ],
  },
  {
    name: "Reseller customer (Napoli)",
    description: "Reseller from South Italy",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "reseller",
          email: `info@sud-distribution-${randomInt(1, 99)}.it`,
          company_name: "Sud Distribution SpA",
          legal_info: {
            vat_number: vatNumber,
            pec_email: "suddistribution@pec.it",
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "both",
              label: "Sede e Magazzino",
              is_default: true,
              recipient_name: "Sud Distribution SpA",
              street_address: "Via Porto 25",
              city: "Napoli",
              province: "NA",
              postal_code: "80100",
              country: "IT",
            },
          ],
        },
      };
    },
    items: () => [
      { entity_code: "PROD-004", sku: "SKU-004", quantity: 50, list_price: 45.0, unit_price: 30.0, vat_rate: 22, name: "Tool Master" },
    ],
  },
  {
    name: "Reseller with multiple addresses",
    description: "Reseller with HQ and warehouse",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "reseller",
          email: `ordini@multi-location-${randomInt(1, 99)}.it`,
          company_name: "Multi Location Distribution Srl",
          external_code: `RES-ML-${randomInt(100, 999)}`,
          legal_info: {
            vat_number: vatNumber,
            fiscal_code: vatNumber.replace("IT", ""),
            pec_email: "multilocation@pec.it",
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "billing",
              label: "Sede Legale",
              recipient_name: "Multi Location Distribution Srl",
              street_address: "Via Roma 1",
              city: "Milano",
              province: "MI",
              postal_code: "20100",
              country: "IT",
            },
            {
              address_type: "delivery",
              label: "Magazzino Nord",
              is_default: true,
              recipient_name: "Multi Location - Nord",
              street_address: "Via Logistica 10",
              city: "Torino",
              province: "TO",
              postal_code: "10100",
              country: "IT",
            },
            {
              address_type: "delivery",
              label: "Magazzino Sud",
              recipient_name: "Multi Location - Sud",
              street_address: "Via Industria 5",
              city: "Napoli",
              province: "NA",
              postal_code: "80100",
              country: "IT",
            },
          ],
        },
      };
    },
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 50, list_price: 25.0, unit_price: 16.0, vat_rate: 22, name: "Widget Premium" },
      { entity_code: "PROD-005", sku: "SKU-005", quantity: 10, list_price: 65.0, unit_price: 45.0, vat_rate: 22, name: "Supply Kit" },
    ],
  },

  // 13-15: Orders with customer lookup by VAT (existing customer)
  {
    name: "Lookup by VAT (scenario 1)",
    description: "Find existing customer by VAT number",
    createPayload: () => ({
      customer: {
        email: "different@email.it",
        customer_type: "business",
        legal_info: {
          vat_number: "IT12345678901", // Will be created by earlier order or fail
        },
      },
    }),
    items: () => [
      { entity_code: "PROD-002", sku: "SKU-002", quantity: 3, list_price: 150.0, unit_price: 130.0, vat_rate: 22, name: "Gadget Pro" },
    ],
  },
  {
    name: "Lookup by external_code",
    description: "Find existing customer by ERP code",
    createPayload: () => ({
      customer_code: "CLI-0001", // External code lookup
    }),
    items: () => [
      { entity_code: "PROD-003", sku: "SKU-003", quantity: 25, list_price: 12.5, unit_price: 10.5, vat_rate: 10, name: "Component X" },
    ],
  },
  {
    name: "Full order with PO reference",
    description: "Complete B2B order with PO",
    createPayload: () => {
      const vatNumber = generateVatNumber();
      return {
        customer: {
          customer_type: "business",
          email: `final-order@company-${randomInt(1, 99)}.it`,
          company_name: "Final Order Company Srl",
          legal_info: {
            vat_number: vatNumber,
            sdi_code: generateSdiCode(),
          },
          addresses: [
            {
              address_type: "both",
              label: "Sede",
              is_default: true,
              recipient_name: "Final Order Company Srl",
              street_address: "Via Finale 99",
              city: "Firenze",
              province: "FI",
              postal_code: "50100",
              country: "IT",
            },
          ],
        },
        po_reference: `PO-2025-${randomInt(1000, 9999)}`,
        notes: "Consegna urgente - chiamare prima",
      };
    },
    items: () => [
      { entity_code: "PROD-001", sku: "SKU-001", quantity: 30, list_price: 25.0, unit_price: 19.0, vat_rate: 22, name: "Widget Premium" },
      { entity_code: "PROD-002", sku: "SKU-002", quantity: 5, list_price: 150.0, unit_price: 120.0, vat_rate: 22, name: "Gadget Pro" },
      { entity_code: "PROD-004", sku: "SKU-004", quantity: 15, list_price: 45.0, unit_price: 38.0, vat_rate: 22, name: "Tool Master" },
    ],
  },
];

// ============================================
// AUTHENTICATION
// ============================================

async function login(): Promise<boolean> {
  if (!B2B_PASSWORD) {
    console.error("ERROR: B2B_PASSWORD not set. Use --password or set B2B_PASSWORD env variable.");
    return false;
  }

  console.log(`Logging in as ${B2B_USERNAME}...`);

  const res = await fetch(`${API_BASE}/api/b2b/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": TENANT_ID,
    },
    body: JSON.stringify({
      username: B2B_USERNAME,
      password: B2B_PASSWORD,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`Login failed: ${err.error}`);
    return false;
  }

  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // Parse the cookie - iron-session uses vinc_b2b_session
    const match = setCookie.match(/vinc_b2b_session=([^;]+)/);
    if (match) {
      sessionCookie = `vinc_b2b_session=${match[1]}`;
      console.log("Login successful, session established.\n");
      return true;
    }
  }

  console.error("Login successful but no session cookie received.");
  return false;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-ID": TENANT_ID,
  };
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }
  return headers;
}

// ============================================
// API CALLS
// ============================================

async function createTestCustomers(): Promise<void> {
  console.log("Creating prerequisite test customers...");

  const customers = [
    {
      customer_id: "test-customer-001",
      customer_type: "business",
      email: "test-customer-001@test.it",
      company_name: "Test Company 001",
      external_code: "CLI-0001",
      legal_info: {
        vat_number: "IT12345678901",
        sdi_code: "TEST001",
      },
      addresses: [
        {
          address_type: "both",
          label: "Test Address",
          is_default: true,
          recipient_name: "Test Company 001",
          street_address: "Via Test 1",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
        },
      ],
    },
    {
      customer_id: "test-customer-002",
      customer_type: "business",
      email: "test-customer-002@test.it",
      company_name: "Test Company 002",
      external_code: "CLI-0002",
      addresses: [
        {
          address_type: "both",
          label: "Test Address 2",
          is_default: true,
          recipient_name: "Test Company 002",
          street_address: "Via Test 2",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
          country: "IT",
        },
      ],
    },
  ];

  for (const customerData of customers) {
    try {
      const res = await fetch(`${API_BASE}/api/b2b/customers`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(customerData),
      });

      if (res.ok) {
        console.log(`  [OK] Created ${customerData.customer_id}`);
      } else {
        const err = await res.json();
        if (err.error?.includes("already exists") || err.error?.includes("duplicate")) {
          console.log(`  [SKIP] ${customerData.customer_id} already exists`);
        } else {
          console.log(`  [WARN] ${customerData.customer_id}: ${err.error}`);
        }
      }
    } catch (e: any) {
      console.log(`  [ERROR] ${customerData.customer_id}: ${e.message}`);
    }
  }
}

async function createOrder(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || "Unknown error");
  }

  return result.order;
}

async function addItemToOrder(orderId: string, item: any): Promise<void> {
  const res = await fetch(`${API_BASE}/api/b2b/orders/${orderId}/items`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(item),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Unknown error");
  }
}

async function getOrder(orderId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/b2b/orders/${orderId}`, {
    headers: getHeaders(),
  });

  const result = await res.json();
  return result.order;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("=".repeat(60));
  console.log("SEED 15 ORDERS VIA API");
  console.log("=".repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Username: ${B2B_USERNAME}\n`);

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.error("\nAuthentication failed. Cannot proceed.");
    console.error("Make sure you have a valid B2B user. Run:");
    console.error(`  npx tsx scripts/seed-b2b-user.ts ${TENANT_ID}`);
    process.exit(1);
  }

  // Create prerequisite customers
  await createTestCustomers();
  console.log("");

  // Process each scenario
  const results: { name: string; status: string; orderId?: string; total?: number; error?: string }[] = [];

  console.log("Creating 15 orders...\n");

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const num = String(i + 1).padStart(2, "0");

    try {
      // Create order
      const payload = scenario.createPayload();
      const order = await createOrder(payload);

      // Add items
      const items = scenario.items();
      for (const item of items) {
        await addItemToOrder(order.order_id, item);
      }

      // Get final order with totals
      const finalOrder = await getOrder(order.order_id);

      results.push({
        name: scenario.name,
        status: "OK",
        orderId: finalOrder.order_id,
        total: finalOrder.order_total,
      });

      console.log(`[${num}] [OK] ${scenario.name}`);
      console.log(`        Order: ${finalOrder.order_id} | Items: ${finalOrder.items?.length || 0} | Total: EUR ${finalOrder.order_total?.toFixed(2) || "0.00"}`);
    } catch (e: any) {
      results.push({
        name: scenario.name,
        status: "FAILED",
        error: e.message,
      });

      console.log(`[${num}] [FAILED] ${scenario.name}`);
      console.log(`        Error: ${e.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.status === "OK");
  const failed = results.filter((r) => r.status === "FAILED");

  console.log(`Total: ${results.length} | OK: ${successful.length} | Failed: ${failed.length}`);

  if (successful.length > 0) {
    const totalValue = successful.reduce((sum, r) => sum + (r.total || 0), 0);
    console.log(`Total Order Value: EUR ${totalValue.toFixed(2)}`);
  }

  if (failed.length > 0) {
    console.log("\nFailed scenarios:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
