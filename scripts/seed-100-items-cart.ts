/**
 * Seed Cart with 100 Items
 *
 * Creates a cart with 100 line items for testing
 * Run with: npx tsx scripts/seed-100-items-cart.ts
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const TEST_USERNAME = process.env.TEST_USERNAME || "b2b_admin";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "admin123";

let sessionCookie: string | null = null;

// Generate 100 different products
function generateProducts(count: number) {
  const products = [];
  const categories = ["Electronics", "Tools", "Parts", "Accessories", "Components"];
  const brands = ["BrandA", "BrandB", "BrandC", "BrandD", "BrandE"];

  for (let i = 1; i <= count; i++) {
    const basePrice = Math.round((Math.random() * 200 + 10) * 100) / 100;
    const discount = Math.round(Math.random() * 30); // 0-30% discount
    const discountedPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

    products.push({
      entity_code: `PROD-${String(i).padStart(5, "0")}`,
      sku: `SKU-${String(i).padStart(5, "0")}`,
      name: `Test Product ${i} - ${categories[i % categories.length]}`,
      list_price: basePrice,
      unit_price: discountedPrice,
      vat_rate: i % 3 === 0 ? 10 : 22, // Mix of VAT rates
      quantity: Math.floor(Math.random() * 10) + 1,
      brand: brands[i % brands.length],
      category: categories[i % categories.length],
      discount_percent: discount,
    });
  }

  return products;
}

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

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }

  return response;
}

async function login() {
  console.log("Logging in...");
  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/login`, {
    method: "POST",
    body: JSON.stringify({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(`Login failed: ${data.error}`);
  }

  console.log("✓ Login successful\n");
}

async function getOrCreateCart() {
  console.log("Getting/Creating cart...");

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/cart/active`, {
    method: "POST",
    body: JSON.stringify({
      customer_code: "100ITEMS",
      address_code: "MAIN",
      pricelist_type: "VEND",
      pricelist_code: "02",
      customer: {
        email: "test100items@example.com",
        customer_type: "business",
        company_name: "100 Items Test Company",
      },
      address: {
        address_type: "delivery",
        recipient_name: "100 Items Test Company",
        street_address: "Via Test 100",
        city: "Milano",
        province: "MI",
        postal_code: "20100",
        country: "IT",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get/create cart: ${data.error}`);
  }

  console.log(`✓ Cart obtained: ${data.cart_id}`);
  console.log(`  Cart Number: ${data.order?.cart_number}/${data.order?.year}`);
  console.log(`  Is New: ${data.is_new}`);
  console.log(`  Existing Items: ${data.order?.items?.length || 0}\n`);

  return data;
}

async function addItemToCart(cartId: string, product: ReturnType<typeof generateProducts>[0], index: number) {
  const itemPayload = {
    entity_code: product.entity_code,
    sku: product.sku,
    quantity: product.quantity,
    list_price: product.list_price,
    unit_price: product.unit_price,
    vat_rate: product.vat_rate,
    name: product.name,
    brand: product.brand,
    category: product.category,
    discounts: product.discount_percent > 0 ? [{
      tier: 1,
      type: "percentage",
      value: -product.discount_percent,
      reason: "customer_group",
    }] : [],
    min_order_quantity: 1,
    pack_size: 1,
    promo_code: index % 5 === 0 ? `PROMO-${Math.floor(index / 5)}` : undefined,
    promo_row: index % 5 === 0 ? index : undefined,
    added_from: "seed_script",
    added_via: "100_items_test",
  };

  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/orders/${cartId}/items`, {
    method: "POST",
    body: JSON.stringify(itemPayload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(`Failed to add item ${index}: ${data.error}`);
  }

  return response.json();
}

async function getCartDetails(cartId: string) {
  const response = await fetchWithAuth(`${BASE_URL}/api/b2b/orders/${cartId}`);
  return response.json();
}

async function main() {
  console.log("=".repeat(60));
  console.log("SEED CART WITH 100 ITEMS");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Login
    await login();

    // Get or create cart
    const cartResult = await getOrCreateCart();
    const cartId = cartResult.cart_id;

    // Generate 100 products
    const products = generateProducts(100);

    console.log("Adding 100 items to cart...\n");

    // Add items in batches for better performance logging
    const batchSize = 10;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const promises = batch.map((product, idx) =>
        addItemToCart(cartId, product, i + idx + 1)
      );

      await Promise.all(promises);

      const progress = Math.min(i + batchSize, products.length);
      process.stdout.write(`\r  Progress: ${progress}/100 items added`);
    }

    console.log("\n");

    // Get final cart details
    const finalCart = await getCartDetails(cartId);

    if (finalCart.order) {
      const order = finalCart.order;
      console.log("=".repeat(60));
      console.log("CART SUMMARY");
      console.log("=".repeat(60));
      console.log(`Cart ID:        ${order.order_id}`);
      console.log(`Cart Number:    ${order.cart_number}/${order.year}`);
      console.log(`Customer Code:  ${order.customer_code}`);
      console.log(`Status:         ${order.status}`);
      console.log(`Total Items:    ${order.items?.length || 0}`);
      console.log(`Subtotal Gross: EUR ${order.subtotal_gross?.toFixed(2)}`);
      console.log(`Subtotal Net:   EUR ${order.subtotal_net?.toFixed(2)}`);
      console.log(`Total Discount: EUR ${order.total_discount?.toFixed(2)}`);
      console.log(`Total VAT:      EUR ${order.total_vat?.toFixed(2)}`);
      console.log(`Order Total:    EUR ${order.order_total?.toFixed(2)}`);
      console.log("=".repeat(60));

      // Show first 5 and last 5 items
      console.log("\nFirst 5 items:");
      for (const item of order.items.slice(0, 5)) {
        console.log(`  ${item.line_number}: ${item.entity_code} - ${item.name} x${item.quantity} = EUR ${item.line_total?.toFixed(2)}`);
      }

      console.log("\n...\n");

      console.log("Last 5 items:");
      for (const item of order.items.slice(-5)) {
        console.log(`  ${item.line_number}: ${item.entity_code} - ${item.name} x${item.quantity} = EUR ${item.line_total?.toFixed(2)}`);
      }
    }

    console.log("\n✓ Successfully created cart with 100 items!");

  } catch (error) {
    console.error("\n✗ Error:", error);
    process.exit(1);
  }
}

main();
