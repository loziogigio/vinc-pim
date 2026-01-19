/**
 * Cart API Test Script
 *
 * Tests the cart workflow:
 * 1. Login to get session cookie
 * 2. Get or create active cart (POST /api/b2b/cart/active)
 * 3. Add items to the cart (POST /api/b2b/orders/[id]/items)
 *
 * Run with: npx tsx scripts/test-cart-api.ts
 *
 * Environment variables:
 *   API_URL - Base URL (default: http://localhost:3000)
 *   TEST_USERNAME - B2B username (default: admin)
 *   TEST_PASSWORD - B2B password (default: admin123)
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const TEST_USERNAME = process.env.TEST_USERNAME || "b2b_admin";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "admin123";

// Store session cookie
let sessionCookie: string | null = null;

// Test data matching the provided payload structure
const testPayload = {
  customer_code: "026269",
  address_code: "000000",
  entity_code: "102880",
  quantity: 1,
  price: 152.5864,
  price_discount: 119.0174,
  vat_perc: 22,
  discount: [-22],
  qty_min_packing: 1,
  pricelist_type: "VEND",
  pricelist_code: "02",
  promo_code: "017",
  promo_row: 67,
};

// Customer and address details for creation if not exists
const customerDetails = {
  email: "test026269@example.com",
  customer_type: "business",
  company_name: "Test Company 026269",
};

const addressDetails = {
  address_type: "delivery",
  recipient_name: "Test Company 026269",
  street_address: "Via Test 1",
  city: "Milano",
  province: "MI",
  postal_code: "20100",
  country: "IT",
};

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-ID": process.env.VINC_TENANT_ID || "hidros-it",
  };

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  // Capture session cookie from response
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }

  return response;
}

async function step0_Login() {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 0: Login");
  console.log("=".repeat(60));

  const payload = {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
  };

  console.log("\nRequest:");
  console.log("POST", `${BASE_URL}/api/b2b/login`);
  console.log("Body:", JSON.stringify({ ...payload, password: "***" }, null, 2));

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/login`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);
  console.log("Body:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`Login failed: ${data.error}`);
  }

  console.log("\n✓ Login successful");
  console.log(`  Session cookie: ${sessionCookie ? "obtained" : "not set"}`);

  return data;
}

async function step1_GetOrCreateCart() {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Get or Create Active Cart");
  console.log("=".repeat(60));

  const payload = {
    customer_code: testPayload.customer_code,
    address_code: testPayload.address_code,
    pricelist_type: testPayload.pricelist_type,
    pricelist_code: testPayload.pricelist_code,
    // Include customer/address details for creation if not found
    customer: customerDetails,
    address: addressDetails,
  };

  console.log("\nRequest:");
  console.log("POST", `${BASE_URL}/api/b2b/cart/active`);
  console.log("Body:", JSON.stringify(payload, null, 2));

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/cart/active`, {
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

  return data;
}

async function step2_AddItemToCart(cartId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Add Item to Cart");
  console.log("=".repeat(60));

  // Map the incoming payload to our API format
  const itemPayload = {
    entity_code: testPayload.entity_code,
    sku: testPayload.entity_code, // Using entity_code as SKU
    quantity: testPayload.quantity,
    list_price: testPayload.price,
    unit_price: testPayload.price_discount,
    vat_rate: testPayload.vat_perc,
    name: `Product ${testPayload.entity_code}`, // Would come from product lookup

    // Discounts
    discounts: testPayload.discount.map((d, i) => ({
      tier: i + 1,
      type: "percentage",
      value: d,
      reason: "customer_group",
    })),

    // Quantity constraints
    min_order_quantity: testPayload.qty_min_packing,
    pack_size: testPayload.qty_min_packing,

    // Promo tracking
    promo_code: testPayload.promo_code,
    promo_row: testPayload.promo_row,

    // Tracking
    added_from: "api_test",
    added_via: "test_script",
  };

  console.log("\nRequest:");
  console.log("POST", `${BASE_URL}/api/b2b/orders/${cartId}/items`);
  console.log("Body:", JSON.stringify(itemPayload, null, 2));

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/orders/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify(itemPayload),
  });

  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);
  console.log("Body:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`Failed to add item: ${data.error}`);
  }

  return data;
}

async function step3_GetCartDetails(cartId: string) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Get Cart Details");
  console.log("=".repeat(60));

  console.log("\nRequest:");
  console.log("GET", `${BASE_URL}/api/b2b/orders/${cartId}`);

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/orders/${cartId}`);
  const data = await response.json();

  console.log("\nResponse:");
  console.log("Status:", response.status);
  console.log("Body:", JSON.stringify(data, null, 2));

  return data;
}

async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("CART API TEST");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant: ${process.env.VINC_TENANT_ID || "hidros-it"}`);
  console.log(`Test payload:`);
  console.log(JSON.stringify(testPayload, null, 2));

  try {
    // Step 0: Login
    await step0_Login();

    // Step 1: Get or create cart
    const cartResult = await step1_GetOrCreateCart();
    const cartId = cartResult.cart_id;

    console.log("\n✓ Cart obtained successfully");
    console.log(`  Cart ID: ${cartId}`);
    console.log(`  Cart Number: ${cartResult.order?.cart_number}/${cartResult.order?.year}`);
    console.log(`  Is New: ${cartResult.is_new}`);

    // Step 2: Add item to cart
    const itemResult = await step2_AddItemToCart(cartId);

    console.log("\n✓ Item added successfully");
    if (itemResult.item) {
      console.log(`  Line Number: ${itemResult.item.line_number}`);
      console.log(`  Entity Code: ${itemResult.item.entity_code}`);
      console.log(`  Quantity: ${itemResult.item.quantity}`);
      console.log(`  Line Total: EUR ${itemResult.item.line_total?.toFixed(2)}`);
    }

    // Step 3: Get cart details
    const orderResult = await step3_GetCartDetails(cartId);

    if (orderResult.order) {
      const order = orderResult.order;
      console.log("\n✓ Cart details retrieved");
      console.log(`  Cart #${order.cart_number}/${order.year}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Is Current: ${order.is_current}`);
      console.log(`  Items: ${order.items?.length || 0}`);
      console.log(`  Subtotal Net: EUR ${order.subtotal_net?.toFixed(2)}`);
      console.log(`  Total VAT: EUR ${order.total_vat?.toFixed(2)}`);
      console.log(`  Order Total: EUR ${order.order_total?.toFixed(2)}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("ALL TESTS PASSED!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("TEST FAILED!");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  }
}

runTests();
