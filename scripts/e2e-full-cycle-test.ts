/**
 * Full Cycle E2E Test
 *
 * Tests the complete B2B flow:
 * 1. Create portal user with company/addresses
 * 2. Create order from product info
 * 3. Fetch portal user information
 *
 * Usage: npx tsx scripts/e2e-full-cycle-test.ts
 */

import { nanoid } from "nanoid";

const API_BASE = process.env.API_BASE || "http://localhost:3001";
const API_KEY_ID = "ak_dfl-eventi-it_112233445566";
const API_SECRET = "sk_112233445566778899aabbccddeeff00";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": API_KEY_ID,
  "x-api-secret": API_SECRET,
};

interface TestResult {
  portal_user_id?: string;
  customer_id?: string;
  company_name?: string;
  addresses_count?: number;
  product_used?: string;
  order_id?: string;
  order_total?: number;
}

async function main() {
  console.log("=== FULL CYCLE E2E TEST ===\n");
  console.log(`API Base: ${API_BASE}`);
  console.log(`Tenant: dfl-eventi-it\n`);

  const testId = nanoid(6);
  const result: TestResult = {};

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Create Portal User + Customer + Addresses
  // ═══════════════════════════════════════════════════════════
  console.log("STEP 1: Create Portal User + Customer + Addresses");
  console.log("─".repeat(50));

  // 1a. Create Portal User (empty customer_access initially)
  console.log("  1a. Creating portal user...");
  const portalUserRes = await fetch(`${API_BASE}/api/b2b/portal-users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: `testuser_${testId}`,
      email: `testuser_${testId}@example.com`,
      password: "TestPass123!",
    }),
  });
  const portalUserData = await portalUserRes.json();

  if (!portalUserRes.ok) {
    console.error("  ❌ Failed to create portal user:", portalUserData.error);
    process.exit(1);
  }

  result.portal_user_id = portalUserData.portal_user?.portal_user_id;
  console.log("  ✅ Portal User created:", result.portal_user_id);

  // 1b. Create Customer with Company + Addresses
  console.log("  1b. Creating customer with addresses...");
  const customerRes = await fetch(`${API_BASE}/api/b2b/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer_type: "business",
      company_name: `Test Company ${testId}`,
      vat_number: `IT${testId}123456`,
      email: `company_${testId}@example.com`,
      phone: "+39 02 1234567",
      addresses: [
        {
          address_type: "both",
          is_default: true,
          label: "Headquarters",
          street_address: "Via Roma 1",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
          recipient_name: `Test Company ${testId}`,
        },
        {
          address_type: "delivery",
          is_default: false,
          label: "Warehouse",
          street_address: "Via Torino 50",
          city: "Milano",
          province: "MI",
          postal_code: "20123",
          country: "IT",
          recipient_name: "Warehouse Manager",
        },
      ],
    }),
  });
  const customerData = await customerRes.json();

  if (!customerRes.ok) {
    console.error("  ❌ Failed to create customer:", customerData.error);
    process.exit(1);
  }

  result.customer_id = customerData.customer?.customer_id;
  result.company_name = customerData.customer?.company_name;
  result.addresses_count = customerData.customer?.addresses?.length || 0;

  console.log("  ✅ Customer created:", result.customer_id);
  console.log("     Company:", result.company_name);
  console.log("     Addresses:", result.addresses_count);

  // 1c. Assign customer access to portal user
  console.log("  1c. Assigning customer access to portal user...");
  const updatePortalRes = await fetch(
    `${API_BASE}/api/b2b/portal-users/${result.portal_user_id}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        customer_access: [
          {
            customer_id: result.customer_id,
            address_access: "all",
          },
        ],
      }),
    }
  );
  const updatedPortalUser = await updatePortalRes.json();

  if (!updatePortalRes.ok) {
    console.error("  ❌ Failed to assign customer access:", updatedPortalUser.error);
    process.exit(1);
  }

  console.log("  ✅ Portal user assigned to customer");

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Fetch Product Info
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 2: Fetch Product Info");
  console.log("─".repeat(50));

  // First, list products to find one
  console.log("  2a. Listing published products...");
  const productsRes = await fetch(
    `${API_BASE}/api/b2b/pim/products?limit=1&status=published`,
    { headers }
  );
  const productsData = await productsRes.json();

  let productCode: string;

  if (!productsData.products?.length) {
    console.log("  ⚠️  No published products found. Creating test product...");

    // Create a test product if none exists
    const importRes = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        products: [
          {
            entity_code: `TEST-PROD-${testId}`,
            sku: `SKU-${testId}`,
            name: { it: "Prodotto Test", en: "Test Product" },
            status: "published",
            price: 25.0,
            vat_rate: 22,
            packaging_options: [
              {
                code: "PZ",
                label: { it: "Pezzo", en: "Piece" },
                qty: 1,
                uom: "PZ",
                is_default: true,
                is_smallest: true,
                is_sellable: true,
                pricing: { list: 25.0, retail: 50.0 },
              },
            ],
          },
        ],
      }),
    });

    if (!importRes.ok) {
      const importData = await importRes.json();
      console.error("  ❌ Failed to create test product:", importData.error);
      process.exit(1);
    }

    productCode = `TEST-PROD-${testId}`;
    console.log("  ✅ Test product created:", productCode);
  } else {
    productCode = productsData.products[0].entity_code;
    console.log("  ✅ Found existing product:", productCode);
  }

  // Fetch the product details
  console.log("  2b. Fetching product details...");
  const productRes = await fetch(`${API_BASE}/api/b2b/pim/products/${productCode}`, {
    headers,
  });
  const productData = await productRes.json();

  if (!productRes.ok) {
    console.error("  ❌ Failed to fetch product:", productData.error);
    process.exit(1);
  }

  const product = productData.product;
  result.product_used = product?.entity_code;

  console.log("  ✅ Product details fetched");
  console.log("     Entity Code:", product?.entity_code);
  console.log("     Name:", product?.name?.it || product?.name);
  console.log("     Price:", product?.price);
  console.log("     Packaging options:", product?.packaging_options?.length || 0);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Create Order with Items
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 3: Create Order with Items");
  console.log("─".repeat(50));

  // 3a. Create draft order
  console.log("  3a. Creating draft order...");
  const defaultAddress = customerData.customer.addresses?.find(
    (a: { is_default?: boolean }) => a.is_default
  );

  const orderRes = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer_id: result.customer_id,
      shipping_address_id: defaultAddress?.address_id,
      order_type: "b2b",
      price_list_type: "wholesale",
      currency: "EUR",
      po_reference: `PO-${testId}`,
      notes: "Full cycle test order",
    }),
  });
  const orderData = await orderRes.json();

  if (!orderRes.ok) {
    console.error("  ❌ Failed to create order:", orderData.error);
    process.exit(1);
  }

  result.order_id = orderData.order?.order_id;
  console.log("  ✅ Order created:", result.order_id);
  console.log("     Status:", orderData.order?.status);

  // 3b. Add product to order
  console.log("  3b. Adding item to order...");
  const packaging = product?.packaging_options?.[0] || {};
  const pricing = packaging.pricing || {};

  const addItemRes = await fetch(`${API_BASE}/api/b2b/orders/${result.order_id}/items`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      entity_code: product.entity_code,
      sku: product.sku || product.entity_code,
      quantity: 10,
      list_price: pricing.list || product.price || 25.0,
      unit_price: pricing.list || product.price || 25.0,
      vat_rate: product.vat_rate || 22,
      name: product.name?.it || product.name || "Test Product",
      pack_size: packaging.qty || 1,
      quantity_unit: packaging.uom || "PZ",
    }),
  });
  const itemData = await addItemRes.json();

  if (!addItemRes.ok) {
    console.error("  ❌ Failed to add item:", itemData.error);
    process.exit(1);
  }

  result.order_total = itemData.order?.order_total;
  console.log("  ✅ Item added to order");
  console.log("     Order total:", result.order_total);

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Fetch Portal User Info
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 4: Fetch Portal User Info");
  console.log("─".repeat(50));

  // 4a. Get portal user details
  console.log("  4a. Fetching portal user details...");
  const getPortalRes = await fetch(
    `${API_BASE}/api/b2b/portal-users/${result.portal_user_id}`,
    { headers }
  );
  const portalInfo = await getPortalRes.json();

  if (!getPortalRes.ok) {
    console.error("  ❌ Failed to fetch portal user:", portalInfo.error);
    process.exit(1);
  }

  console.log("  ✅ Portal user details fetched");
  console.log("     Portal User ID:", portalInfo.portal_user?.portal_user_id);
  console.log("     Username:", portalInfo.portal_user?.username);
  console.log("     Email:", portalInfo.portal_user?.email);
  console.log(
    "     Customer Access:",
    portalInfo.portal_user?.customer_access?.length || 0,
    "customer(s)"
  );

  // 4b. Get orders for customer
  console.log("  4b. Fetching orders for customer...");
  const ordersRes = await fetch(
    `${API_BASE}/api/b2b/orders?customer_id=${result.customer_id}`,
    { headers }
  );
  const ordersData = await ordersRes.json();

  if (!ordersRes.ok) {
    console.error("  ❌ Failed to fetch orders:", ordersData.error);
    process.exit(1);
  }

  console.log("  ✅ Orders fetched");
  console.log("     Orders for customer:", ordersData.orders?.length || 0);

  // ═══════════════════════════════════════════════════════════
  // CLEANUP (Optional)
  // ═══════════════════════════════════════════════════════════
  console.log("\nCLEANUP");
  console.log("─".repeat(50));

  // Delete order
  console.log("  Deleting test order...");
  await fetch(`${API_BASE}/api/b2b/orders/${result.order_id}`, {
    method: "DELETE",
    headers,
  });
  console.log("  ✅ Order deleted");

  // Delete portal user
  console.log("  Deleting test portal user...");
  await fetch(`${API_BASE}/api/b2b/portal-users/${result.portal_user_id}`, {
    method: "DELETE",
    headers,
  });
  console.log("  ✅ Portal user deleted");

  // Delete customer
  console.log("  Deleting test customer...");
  await fetch(`${API_BASE}/api/b2b/customers/${result.customer_id}`, {
    method: "DELETE",
    headers,
  });
  console.log("  ✅ Customer deleted");

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(50));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(50));
  console.log(JSON.stringify(result, null, 2));

  console.log("\n✅ Full cycle test completed successfully!");
}

main().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
