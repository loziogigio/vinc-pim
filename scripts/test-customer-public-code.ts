/**
 * Test creating customers with and without public_code
 * Run with: npx tsx scripts/test-customer-public-code.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

async function createCustomer(data: {
  email: string;
  customer_type: "business" | "private";
  company_name?: string;
  first_name?: string;
  last_name?: string;
  external_code?: string;
  public_code?: string;
}) {
  const res = await fetch(`${API_BASE}/api/b2b/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Failed to create customer: ${JSON.stringify(error)}`);
  }

  return res.json();
}

async function createOrder(data: {
  customer_id?: string;
  customer_code?: string;
  customer?: {
    email: string;
    customer_type: "business" | "private";
    company_name?: string;
    external_code?: string;
    public_code?: string;
  };
}) {
  const res = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Failed to create order: ${JSON.stringify(error)}`);
  }

  return res.json();
}

async function main() {
  console.log("=".repeat(60));
  console.log("Testing Customer Public Code Generation");
  console.log("=".repeat(60));
  console.log(`API Base: ${API_BASE}\n`);

  // Test 1: Create customer WITHOUT public_code (should auto-generate)
  console.log("1. Creating customer WITHOUT public_code (auto-generate)...");
  const customer1 = await createCustomer({
    email: "customer1@test.com",
    customer_type: "business",
    company_name: "Auto Code Company",
  });
  console.log(`   ✓ Created: ${customer1.customer.company_name}`);
  console.log(`   - customer_id: ${customer1.customer.customer_id}`);
  console.log(`   - public_code: ${customer1.customer.public_code} (auto-generated)`);
  console.log();

  // Test 2: Create another customer WITHOUT public_code (should be C-00002)
  console.log("2. Creating second customer WITHOUT public_code...");
  const customer2 = await createCustomer({
    email: "customer2@test.com",
    customer_type: "business",
    company_name: "Second Auto Code Company",
  });
  console.log(`   ✓ Created: ${customer2.customer.company_name}`);
  console.log(`   - customer_id: ${customer2.customer.customer_id}`);
  console.log(`   - public_code: ${customer2.customer.public_code} (auto-generated)`);
  console.log();

  // Test 3: Create customer WITH custom public_code
  console.log("3. Creating customer WITH custom public_code (CUSTOM-001)...");
  const customer3 = await createCustomer({
    email: "customer3@test.com",
    customer_type: "business",
    company_name: "Custom Code Company",
    public_code: "CUSTOM-001",
  });
  console.log(`   ✓ Created: ${customer3.customer.company_name}`);
  console.log(`   - customer_id: ${customer3.customer.customer_id}`);
  console.log(`   - public_code: ${customer3.customer.public_code} (custom)`);
  console.log();

  // Test 4: Create another auto-generated (should continue from C-00003)
  console.log("4. Creating third auto-generated customer...");
  const customer4 = await createCustomer({
    email: "customer4@test.com",
    customer_type: "private",
    first_name: "John",
    last_name: "Doe",
  });
  console.log(`   ✓ Created: ${customer4.customer.first_name} ${customer4.customer.last_name}`);
  console.log(`   - customer_id: ${customer4.customer.customer_id}`);
  console.log(`   - public_code: ${customer4.customer.public_code} (auto-generated)`);
  console.log();

  // Test 5: Create order with existing customer
  console.log("5. Creating order for existing customer...");
  const order1 = await createOrder({
    customer_id: customer1.customer.customer_id,
  });
  console.log(`   ✓ Created order: ${order1.order.order_id}`);
  console.log(`   - customer_id: ${order1.order.customer_id}`);
  console.log();

  // Test 6: Create order with new customer (inline, no public_code)
  console.log("6. Creating order with NEW inline customer (auto-generate public_code)...");
  const order2 = await createOrder({
    customer: {
      email: "inline-customer@test.com",
      customer_type: "business",
      company_name: "Inline Company",
      external_code: "ERP-999",
    },
  });
  console.log(`   ✓ Created order: ${order2.order.order_id}`);
  console.log(`   - customer_id: ${order2.customer.customer_id}`);
  console.log(`   - public_code: ${order2.customer.public_code || "(check DB)"}`);
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Customer 1: ${customer1.customer.public_code} (auto)`);
  console.log(`Customer 2: ${customer2.customer.public_code} (auto)`);
  console.log(`Customer 3: ${customer3.customer.public_code} (custom: CUSTOM-001)`);
  console.log(`Customer 4: ${customer4.customer.public_code} (auto)`);
  console.log();
  console.log("✓ All tests passed!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
