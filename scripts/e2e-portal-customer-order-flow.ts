/**
 * E2E: Portal User → Customer → Order Flow
 *
 * Tests the complete B2B onboarding and ordering flow:
 * 1. Create portal user
 * 2. Create customer with company info and addresses
 * 3. Assign customer access to portal user
 * 4. Fetch product from PIM
 * 5. Create order with product
 * 6. Verify admin can see portal user info
 * 7. Portal user login & order recovery (using portal token)
 *    - Login with credentials
 *    - Retrieve orders list
 *    - Access specific order details
 *    - View customer info
 *
 * Run: npx tsx scripts/e2e-portal-customer-order-flow.ts
 */

import { nanoid } from "nanoid";

const API_BASE = process.env.API_BASE || "http://localhost:3001";
const API_KEY_ID = "ak_dfl-eventi-it_112233445566";
const API_SECRET = "sk_112233445566778899aabbccddeeff00";

const headers = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": API_KEY_ID,
  "x-api-secret": API_SECRET,
};

async function main() {
  console.log("=== FULL CYCLE E2E TEST ===\n");

  const testId = nanoid(6);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Create Portal User + Customer + Addresses
  // ═══════════════════════════════════════════════════════════
  console.log("STEP 1: Create Portal User + Customer + Addresses");

  // 1a. Create Portal User (empty customer_access initially)
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
    console.error("  Failed to create portal user:", portalUserData);
    process.exit(1);
  }
  console.log("  Portal User created:", portalUserData.portal_user?.portal_user_id);

  // 1b. Create Customer with Company + Addresses
  const customerRes = await fetch(`${API_BASE}/api/b2b/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer_type: "business",
      company_name: `Test Company ${testId}`,
      email: `company_${testId}@example.com`,
      phone: "+39 02 1234567",
      public_code: `C-TEST-${testId}`,
      legal_info: {
        vat_number: `IT12345678901`,
        fiscal_code: `12345678901`,
      },
      addresses: [
        {
          address_type: "delivery",
          is_default: true,
          label: "Headquarters",
          recipient_name: `Test Company ${testId}`,
          street_address: "Via Roma 1",
          city: "Milano",
          province: "MI",
          postal_code: "20100",
          country: "IT",
        },
        {
          address_type: "delivery",
          is_default: false,
          label: "Warehouse",
          recipient_name: `Test Company ${testId} - Warehouse`,
          street_address: "Via Torino 50",
          city: "Milano",
          province: "MI",
          postal_code: "20123",
          country: "IT",
        },
      ],
    }),
  });
  const customerData = await customerRes.json();

  if (!customerRes.ok) {
    console.error("  Failed to create customer:", customerData);
    process.exit(1);
  }
  console.log("  Customer created:", customerData.customer?.customer_id);
  console.log("  Company:", customerData.customer?.company_name);
  console.log("  Addresses:", customerData.customer?.addresses?.length);

  // 1c. Assign customer access to portal user
  const updatePortalRes = await fetch(
    `${API_BASE}/api/b2b/portal-users/${portalUserData.portal_user.portal_user_id}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        customer_access: [
          {
            customer_id: customerData.customer.customer_id,
            address_access: "all",
          },
        ],
      }),
    }
  );
  const updatedPortalUser = await updatePortalRes.json();

  if (!updatePortalRes.ok) {
    console.error("  Failed to assign customer access:", updatedPortalUser);
    process.exit(1);
  }
  console.log("  Portal user assigned to customer");

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Fetch Product Info
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 2: Fetch Product Info");

  // First, list products to find one
  const productsRes = await fetch(
    `${API_BASE}/api/b2b/pim/products?limit=1&status=published`,
    { headers }
  );
  const productsData = await productsRes.json();

  let productCode: string;

  if (!productsData.products?.length) {
    console.log("  No published products found. Creating test product...");
    // Create a test product if none exists
    const importRes = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        products: [{
          entity_code: `TEST-PROD-${testId}`,
          sku: `SKU-${testId}`,
          name: { it: "Prodotto Test", en: "Test Product" },
          status: "published",
          price: 25.00,
          vat_rate: 22,
          packaging_options: [{
            code: "PZ",
            label: { it: "Pezzo", en: "Piece" },
            qty: 1,
            uom: "PZ",
            is_default: true,
            is_smallest: true,
            pricing: { list: 25.00, retail: 50.00 }
          }]
        }]
      }),
    });
    const importData = await importRes.json();
    console.log("  Test product created");
    productCode = `TEST-PROD-${testId}`;
  } else {
    productCode = productsData.products[0].entity_code;
  }

  // Fetch the product details
  const productRes = await fetch(
    `${API_BASE}/api/b2b/pim/products/${productCode}`,
    { headers }
  );
  const productData = await productRes.json();
  const product = productData.product;

  if (!product) {
    console.error("  Failed to fetch product:", productData);
    process.exit(1);
  }

  console.log("  Product:", product?.entity_code);
  console.log("  Name:", product?.name?.it || product?.name);
  console.log("  Price:", product?.price);
  console.log("  Packaging options:", product?.packaging_options?.length || 0);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Create Order with Items
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 3: Create Order with Items");

  // 3a. Create draft order
  interface Address {
    address_id: string;
    is_default: boolean;
  }
  const defaultAddress = customerData.customer.addresses?.find((a: Address) => a.is_default);

  const orderRes = await fetch(`${API_BASE}/api/b2b/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer_id: customerData.customer.customer_id,
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
    console.error("  Failed to create order:", orderData);
    process.exit(1);
  }
  console.log("  Order created:", orderData.order?.order_id);
  console.log("  Status:", orderData.order?.status);

  // 3b. Add product to order - select appropriate packaging option
  interface PackagingOption {
    code: string;
    label?: { it?: string } | string;
    qty: number;
    uom: string;
    is_default?: boolean;
    is_smallest?: boolean;
    pricing?: {
      list?: number;
      retail?: number;
      sale?: number;
    };
  }

  // Find packaging: prefer default, then smallest, then first
  const packagingOptions: PackagingOption[] = product?.packaging_options || [];
  const packaging: PackagingOption =
    packagingOptions.find((p: PackagingOption) => p.is_default) ||
    packagingOptions.find((p: PackagingOption) => p.is_smallest) ||
    packagingOptions[0] ||
    { code: "PZ", qty: 1, uom: "PZ" };

  const pricing = packaging.pricing || {};

  // Determine prices: list_price is wholesale, unit_price is what customer pays
  const listPrice = pricing.list ?? product.price ?? 25.00;
  const unitPrice = pricing.sale ?? pricing.list ?? product.price ?? 25.00;

  // Get packaging label (handles multilingual structure)
  const packagingLabel = typeof packaging.label === "string"
    ? packaging.label
    : packaging.label?.it || packaging.code;

  // Calculate valid quantity (must be multiple of pack_size)
  const packSize = packaging.qty || 1;
  const orderQuantity = packSize * 2; // Order 2 packs

  console.log("  Selected packaging:", packaging.code);
  console.log("    Label:", packagingLabel);
  console.log("    Qty per pack:", packaging.qty, packaging.uom);
  console.log("    List price:", listPrice);
  console.log("    Unit price:", unitPrice);
  console.log("    Order quantity:", orderQuantity);

  const addItemRes = await fetch(
    `${API_BASE}/api/b2b/orders/${orderData.order.order_id}/items`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        entity_code: product.entity_code,
        sku: product.sku || product.entity_code,
        quantity: orderQuantity,
        list_price: listPrice,
        unit_price: unitPrice,
        vat_rate: product.vat_rate || 22,
        name: product.name?.it || product.name || "Test Product",
        pack_size: packaging.qty,
        quantity_unit: packaging.uom,
        packaging_code: packaging.code,
        packaging_label: packagingLabel,
        product_source: "pim",
      }),
    }
  );
  const itemData = await addItemRes.json();

  if (!addItemRes.ok) {
    console.error("  Failed to add item:", itemData);
    process.exit(1);
  }
  console.log("  Item added to order");
  console.log("  Line number:", itemData.item?.line_number);
  console.log("  Order total:", itemData.order?.order_total);

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Fetch Portal User Info
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 4: Fetch Portal User Info");

  // 4a. Get portal user details
  const getPortalRes = await fetch(
    `${API_BASE}/api/b2b/portal-users/${portalUserData.portal_user.portal_user_id}`,
    { headers }
  );
  const portalInfo = await getPortalRes.json();

  if (!getPortalRes.ok) {
    console.error("  Failed to get portal user:", portalInfo);
    process.exit(1);
  }
  console.log("  Portal User ID:", portalInfo.portal_user?.portal_user_id);
  console.log("  Username:", portalInfo.portal_user?.username);
  console.log("  Email:", portalInfo.portal_user?.email);
  console.log("  Customer Access:", portalInfo.portal_user?.customer_access?.length, "customer(s)");

  // 4b. Get orders for customer (via admin API key)
  const ordersRes = await fetch(
    `${API_BASE}/api/b2b/orders?customer_id=${customerData.customer.customer_id}`,
    { headers }
  );
  const ordersData = await ordersRes.json();
  console.log("  Orders for customer:", ordersData.orders?.length);

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Portal User Login & Order Recovery
  // ═══════════════════════════════════════════════════════════
  console.log("\nSTEP 5: Portal User Login & Order Recovery");

  // 5a. Portal user logs in with credentials
  const loginRes = await fetch(`${API_BASE}/api/b2b/auth/portal-login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      username: `testuser_${testId}`,
      password: "TestPass123!",
    }),
  });
  const loginData = await loginRes.json();

  if (!loginRes.ok) {
    console.error("  Failed to login portal user:", loginData);
    process.exit(1);
  }
  console.log("  Portal user logged in successfully");
  console.log("  Token received:", loginData.token ? "Yes" : "No");

  const portalToken = loginData.token;

  // 5b. Portal user retrieves their orders using their token
  const portalOrdersRes = await fetch(`${API_BASE}/api/b2b/orders`, {
    headers: {
      ...headers,
      "x-portal-user-token": portalToken,
    },
  });
  const portalOrdersData = await portalOrdersRes.json();

  if (!portalOrdersRes.ok) {
    console.error("  Failed to fetch orders as portal user:", portalOrdersData);
    process.exit(1);
  }
  console.log("  Portal user can see orders:", portalOrdersData.orders?.length);

  // 5c. Portal user retrieves specific order details
  const portalOrderDetailRes = await fetch(
    `${API_BASE}/api/b2b/orders/${orderData.order.order_id}`,
    {
      headers: {
        ...headers,
        "x-portal-user-token": portalToken,
      },
    }
  );
  const portalOrderDetail = await portalOrderDetailRes.json();

  if (!portalOrderDetailRes.ok) {
    console.error("  Failed to fetch order detail as portal user:", portalOrderDetail);
    process.exit(1);
  }
  console.log("  Portal user can access order:", portalOrderDetail.order?.order_id);
  console.log("  Order status:", portalOrderDetail.order?.status);
  console.log("  Order items:", portalOrderDetail.order?.items?.length || portalOrderDetail.items?.length);

  // 5d. Verify portal user can see their customer info
  const portalCustomerRes = await fetch(
    `${API_BASE}/api/b2b/customers/${customerData.customer.customer_id}`,
    {
      headers: {
        ...headers,
        "x-portal-user-token": portalToken,
      },
    }
  );
  const portalCustomerData = await portalCustomerRes.json();

  if (!portalCustomerRes.ok) {
    console.error("  Failed to fetch customer as portal user:", portalCustomerData);
    process.exit(1);
  }
  console.log("  Portal user can see customer:", portalCustomerData.customer?.customer_id);
  console.log("  Company name:", portalCustomerData.customer?.company_name);

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log("\n=== TEST SUMMARY ===");
  console.log(JSON.stringify({
    portal_user_id: portalUserData.portal_user?.portal_user_id,
    customer_id: customerData.customer?.customer_id,
    company_name: customerData.customer?.company_name,
    addresses_count: customerData.customer?.addresses?.length,
    product_used: product?.entity_code,
    order_id: orderData.order?.order_id,
    order_total: itemData.order?.order_total,
  }, null, 2));

  console.log("\n✅ Full cycle test completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
