/**
 * Cart PUBLIC API Test Script
 *
 * Tests the cart workflow WITHOUT authentication:
 * 1. Get or create active cart (POST /api/b2b/cart/active)
 * 2. Add items to the cart (POST /api/b2b/orders/[id]/items)
 * 3. Update item quantity (PATCH /api/b2b/orders/[id]/items) - batch with line_number
 * 4. Get cart details (GET /api/b2b/orders/[id])
 * 5. Remove item (DELETE /api/b2b/orders/[id]/items) - batch with line_numbers
 *
 * Run with: npx tsx scripts/test-cart-public-api.ts
 *
 * Environment variables:
 *   API_URL - Base URL (default: http://localhost:3000)
 */

const BASE_URL = process.env.API_URL || "http://localhost:3001";
const TENANT_ID = process.env.VINC_TENANT_ID || "hidros-it";

// Generate unique codes for this test run
const timestamp = Date.now();
const TEST_CUSTOMER_CODE = `TEST-CLI-${timestamp}`;
const TEST_ADDRESS_CODE = `TEST-ADDR-${timestamp}`;

// Test item data
const testItems = [
  {
    entity_code: `PROD-${timestamp}-001`,
    sku: `SKU-${timestamp}-001`,
    name: "Hydraulic Pump 50L/min",
    quantity: 10,
    list_price: 450.0,
    unit_price: 380.0,
    vat_rate: 22,
    brand: "HydroMax",
    category: "Pumps",
  },
  {
    entity_code: `PROD-${timestamp}-002`,
    sku: `SKU-${timestamp}-002`,
    name: "Directional Control Valve",
    quantity: 5,
    list_price: 280.0,
    unit_price: 240.0,
    vat_rate: 22,
    brand: "FlowTech",
    category: "Valves",
  },
];

// Simple fetch wrapper (no auth needed)
async function apiFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": TENANT_ID,
      ...options.headers,
    },
  });
  return response;
}

// ============================================
// TEST STEPS
// ============================================

async function step1_GetOrCreateCart() {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Get or Create Active Cart (PUBLIC API)");
  console.log("=".repeat(60));

  const payload = {
    customer_code: TEST_CUSTOMER_CODE,
    address_code: TEST_ADDRESS_CODE,
    pricelist_type: "VEND",
    pricelist_code: "02",
    // Customer details (will be created if not found)
    customer: {
      external_code: TEST_CUSTOMER_CODE,
      email: `test-${timestamp}@example.com`,
      customer_type: "business",
      company_name: `Test Company ${timestamp}`,
      phone: "+39 02 1234567",
      legal_info: {
        vat_number: "IT12345678901",
        fiscal_code: "12345678901",
      },
    },
    // Address details (will be created if not found)
    address: {
      external_code: TEST_ADDRESS_CODE,
      address_type: "delivery",
      recipient_name: `Test Company ${timestamp}`,
      street_address: "Via Test 123",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
    },
  };

  console.log("\nRequest:");
  console.log("POST", `${BASE_URL}/api/b2b/cart/active`);
  console.log("Body:", JSON.stringify(payload, null, 2));

  const response = await apiFetch(`${BASE_URL}/api/b2b/cart/active`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);
  console.log("Body:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`Failed to get/create cart: ${data.error}`);
  }

  console.log("\n✓ Cart obtained successfully (PUBLIC API - No Auth)");
  console.log(`  Cart ID: ${data.cart_id}`);
  console.log(`  Is New: ${data.is_new}`);
  console.log(`  Customer Is New: ${data.customer?.is_new}`);
  console.log(`  Address Is New: ${data.address?.is_new}`);

  return data;
}

async function step2_AddItems(cartId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Add Items to Cart (PUBLIC API)");
  console.log("=".repeat(60));

  const results = [];

  for (const item of testItems) {
    console.log(`\nAdding: ${item.name}`);
    console.log("POST", `${BASE_URL}/api/b2b/orders/${cartId}/items`);

    const response = await apiFetch(`${BASE_URL}/api/b2b/orders/${cartId}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to add item: ${data.error}`);
    }

    console.log(`  ✓ Added: ${item.entity_code}, qty=${item.quantity}`);
    console.log(`    Line Total: EUR ${data.item?.line_total?.toFixed(2)}`);

    results.push(data);
  }

  console.log("\n✓ All items added successfully");
  return results;
}

async function step3_UpdateQuantity(cartId: string, lineNumber: number) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Update Item Quantity (PUBLIC API - Batch)");
  console.log("=".repeat(60));

  const newQuantity = 25;
  const payload = {
    items: [{ line_number: lineNumber, quantity: newQuantity }],
  };

  console.log("\nRequest:");
  console.log("PATCH", `${BASE_URL}/api/b2b/orders/${cartId}/items`);
  console.log("Body:", JSON.stringify(payload, null, 2));

  const response = await apiFetch(`${BASE_URL}/api/b2b/orders/${cartId}/items`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);

  if (!response.ok) {
    throw new Error(`Failed to update quantity: ${data.error}`);
  }

  const updatedItem = data.order.items.find((i: { line_number: number }) => i.line_number === lineNumber);
  console.log("\n✓ Quantity updated successfully");
  console.log(`  Line Number: ${lineNumber}`);
  console.log(`  New Quantity: ${updatedItem?.quantity}`);
  console.log(`  New Line Total: EUR ${updatedItem?.line_total?.toFixed(2)}`);
  console.log(`  Results: ${JSON.stringify(data.results)}`);

  return data;
}

async function step4_GetCartDetails(cartId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Get Cart Details (PUBLIC API)");
  console.log("=".repeat(60));

  console.log("\nRequest:");
  console.log("GET", `${BASE_URL}/api/b2b/orders/${cartId}`);

  const response = await apiFetch(`${BASE_URL}/api/b2b/orders/${cartId}`);
  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);

  if (!response.ok) {
    throw new Error(`Failed to get cart: ${data.error}`);
  }

  const order = data.order;
  console.log("\n✓ Cart details retrieved");
  console.log(`  Cart #${order.cart_number}/${order.year}`);
  console.log(`  Status: ${order.status}`);
  console.log(`  Is Current: ${order.is_current}`);
  console.log(`  Items: ${order.items?.length || 0}`);
  console.log("\n  Totals:");
  console.log(`    Subtotal Gross: EUR ${order.subtotal_gross?.toFixed(2)}`);
  console.log(`    Subtotal Net:   EUR ${order.subtotal_net?.toFixed(2)}`);
  console.log(`    Total VAT:      EUR ${order.total_vat?.toFixed(2)}`);
  console.log(`    Order Total:    EUR ${order.order_total?.toFixed(2)}`);

  return data;
}

async function step5_RemoveItem(cartId: string, lineNumber: number) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 5: Remove Item from Cart (PUBLIC API - Batch)");
  console.log("=".repeat(60));

  const payload = {
    line_numbers: [lineNumber],
  };

  console.log("\nRequest:");
  console.log("DELETE", `${BASE_URL}/api/b2b/orders/${cartId}/items`);
  console.log("Body:", JSON.stringify(payload, null, 2));

  const response = await apiFetch(`${BASE_URL}/api/b2b/orders/${cartId}/items`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);

  if (!response.ok) {
    throw new Error(`Failed to remove item: ${data.error}`);
  }

  console.log("\n✓ Item removed successfully");
  console.log(`  Removed line: ${lineNumber}`);
  console.log(`  Remaining items: ${data.order.items?.length || 0}`);
  console.log(`  New Order Total: EUR ${data.order.order_total?.toFixed(2)}`);
  console.log(`  Results: ${JSON.stringify(data.results)}`);

  return data;
}

async function step6_VerifyIdempotency(customerCode: string, addressCode: string, expectedCartId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 6: Verify Idempotency (Same Cart Returned)");
  console.log("=".repeat(60));

  const payload = {
    customer_code: customerCode,
    address_code: addressCode,
  };

  console.log("\nRequest (minimal payload):");
  console.log("POST", `${BASE_URL}/api/b2b/cart/active`);
  console.log("Body:", JSON.stringify(payload, null, 2));

  const response = await apiFetch(`${BASE_URL}/api/b2b/cart/active`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get cart: ${data.error}`);
  }

  const matches = data.cart_id === expectedCartId;
  console.log("\n" + (matches ? "✓" : "✗") + " Idempotency check");
  console.log(`  Expected: ${expectedCartId}`);
  console.log(`  Got:      ${data.cart_id}`);
  console.log(`  Is New:   ${data.is_new}`);

  if (!matches) {
    throw new Error("Idempotency failed: different cart returned");
  }

  return data;
}

// ============================================
// MAIN
// ============================================

async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("CART PUBLIC API TEST");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Test Customer Code: ${TEST_CUSTOMER_CODE}`);
  console.log(`Test Address Code: ${TEST_ADDRESS_CODE}`);
  console.log("\nNOTE: All endpoints are PUBLIC (no authentication required)");

  try {
    // Step 1: Get or create cart
    const cartResult = await step1_GetOrCreateCart();
    const cartId = cartResult.cart_id;

    // Step 2: Add items (returns results with line_numbers)
    const addResults = await step2_AddItems(cartId);
    const firstItemLineNumber = addResults[0]?.item?.line_number;
    const secondItemLineNumber = addResults[1]?.item?.line_number;

    console.log(`\n  First item line_number: ${firstItemLineNumber}`);
    console.log(`  Second item line_number: ${secondItemLineNumber}`);

    // Step 3: Update quantity of first item (using line_number)
    await step3_UpdateQuantity(cartId, firstItemLineNumber);

    // Step 4: Get cart details
    await step4_GetCartDetails(cartId);

    // Step 5: Remove second item (using line_number)
    await step5_RemoveItem(cartId, secondItemLineNumber);

    // Step 6: Verify idempotency
    await step6_VerifyIdempotency(TEST_CUSTOMER_CODE, TEST_ADDRESS_CODE, cartId);

    // Final cart state
    await step4_GetCartDetails(cartId);

    console.log("\n" + "=".repeat(60));
    console.log("ALL TESTS PASSED!");
    console.log("=".repeat(60));
    console.log("\nSummary:");
    console.log(`  Cart ID: ${cartId}`);
    console.log("  Tested endpoints:");
    console.log("    - POST /api/b2b/cart/active (get/create cart)");
    console.log("    - POST /api/b2b/orders/[id]/items (add item)");
    console.log("    - PATCH /api/b2b/orders/[id]/items (update qty - batch)");
    console.log("    - GET /api/b2b/orders/[id] (get cart)");
    console.log("    - DELETE /api/b2b/orders/[id]/items (remove item - batch)");
    console.log("\n  All endpoints work WITHOUT authentication!");
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("TEST FAILED!");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  }
}

runTests();
