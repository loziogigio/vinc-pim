/**
 * E2E Test: Portal User Flow - DFL Tenant
 *
 * Tests the complete flow for DFL-Eventi tenant:
 * 1. Create Portal User
 * 2. Portal User Login
 * 3. Create Customer with Address
 * 4. Add another Address to Customer
 * 5. Verify Customer Access Auto-Assignment
 *
 * Usage: npx tsx scripts/e2e-portal-user-flow-dfl.ts
 */

const BASE_URL = process.env.API_URL || "http://localhost:3001";

// DFL tenant API keys from .test-api-keys.json
const API_KEY_ID = "ak_dfl-eventi-it_112233445566";
const API_SECRET = "sk_112233445566778899aabbccddeeff00";

const TIMESTAMP = Date.now();

// Headers for API key auth
const apiKeyHeaders = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": API_KEY_ID,
  "x-api-secret": API_SECRET,
};

async function step1_createPortalUser() {
  console.log("\n=== STEP 1: Create Portal User (DFL) ===");

  const response = await fetch(`${BASE_URL}/api/b2b/portal-users`, {
    method: "POST",
    headers: apiKeyHeaders,
    body: JSON.stringify({
      username: `dfl-e2euser${TIMESTAMP}`,
      email: `dfl-e2euser${TIMESTAMP}@test.com`,
      password: "TestPassword123!",
      customer_access: [], // Empty - will auto-assign when creating customer
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to create portal user:", data);
    throw new Error(`Failed: ${data.error}`);
  }

  console.log("Portal User Created:");
  console.log("  ID:", data.portal_user.portal_user_id);
  console.log("  Username:", data.portal_user.username);
  console.log("  Email:", data.portal_user.email);

  return data.portal_user;
}

async function step2_portalUserLogin(username: string) {
  console.log("\n=== STEP 2: Portal User Login (DFL) ===");

  const response = await fetch(`${BASE_URL}/api/b2b/auth/portal-login`, {
    method: "POST",
    headers: apiKeyHeaders,
    body: JSON.stringify({
      username,
      password: "TestPassword123!",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to login:", data);
    throw new Error(`Login failed: ${data.error}`);
  }

  console.log("Login Successful:");
  console.log("  Token:", data.token.substring(0, 50) + "...");
  console.log("  User:", data.portal_user.username);

  return data.token;
}

async function step3_createCustomer(token: string) {
  console.log("\n=== STEP 3: Create Customer with Address (DFL) ===");

  const response = await fetch(`${BASE_URL}/api/b2b/customers`, {
    method: "POST",
    headers: {
      ...apiKeyHeaders,
      "x-portal-user-token": token,
    },
    body: JSON.stringify({
      external_code: `DFL-E2E-${TIMESTAMP}`,
      email: `dfl-e2e-customer-${TIMESTAMP}@example.com`,
      customer_type: "business",
      company_name: `DFL E2E Test Company ${TIMESTAMP}`,
      phone: "+39 06 7654321",
      legal_info: {
        vat_number: "IT98765432109",
        pec_email: `dfl-e2e${TIMESTAMP}@pec.it`,
        sdi_code: "DFL1234",
      },
      addresses: [
        {
          external_code: `DFL-ADDR-${TIMESTAMP}`,
          address_type: "both",
          label: "Sede Principale DFL",
          is_default: true,
          recipient_name: `DFL E2E Test Company ${TIMESTAMP}`,
          street_address: "Viale DFL Eventi 100",
          city: "Roma",
          province: "RM",
          postal_code: "00100",
          country: "IT",
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to create customer:", data);
    throw new Error(`Failed: ${data.error}`);
  }

  console.log("Customer Created:");
  console.log("  ID:", data.customer.customer_id);
  console.log("  Public Code:", data.customer.public_code);
  console.log("  Company:", data.customer.company_name);
  console.log("  Addresses:", data.customer.addresses.length);
  console.log("  First Address:", data.customer.addresses[0].address_id);

  return data.customer;
}

async function step4_addAddress(token: string, customerId: string) {
  console.log("\n=== STEP 4: Add Another Address (DFL) ===");

  const response = await fetch(
    `${BASE_URL}/api/b2b/customers/${customerId}/addresses`,
    {
      method: "POST",
      headers: {
        ...apiKeyHeaders,
        "x-portal-user-token": token,
      },
      body: JSON.stringify({
        external_code: `DFL-ADDR2-${TIMESTAMP}`,
        address_type: "delivery",
        label: "Location Eventi",
        is_default: false,
        recipient_name: "DFL Eventi Location",
        street_address: "Piazza Eventi 1",
        city: "Firenze",
        province: "FI",
        postal_code: "50100",
        country: "IT",
        delivery_notes: "Consegna presso location eventi",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to add address:", data);
    throw new Error(`Failed: ${data.error}`);
  }

  console.log("Address Added:");
  console.log("  Address ID:", data.address.address_id);
  console.log("  Label:", data.address.label);
  console.log("  City:", data.address.city);
  console.log("  Total Addresses:", data.customer.addresses.length);

  return data;
}

async function step5_verifyCustomerAccess(portalUserId: string, expectedCustomerId: string) {
  console.log("\n=== STEP 5: Verify Portal User Customer Access (DFL) ===");

  const response = await fetch(
    `${BASE_URL}/api/b2b/portal-users/${portalUserId}`,
    {
      method: "GET",
      headers: apiKeyHeaders,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Failed to get portal user:", data);
    throw new Error(`Failed: ${data.error}`);
  }

  const customerAccess = data.portal_user.customer_access || [];
  console.log("Portal User Customer Access:");
  console.log("  Total customers:", customerAccess.length);

  if (customerAccess.length === 0) {
    throw new Error("Customer access is empty - auto-assignment failed!");
  }

  const hasExpectedCustomer = customerAccess.some(
    (ca: { customer_id: string }) => ca.customer_id === expectedCustomerId
  );

  if (!hasExpectedCustomer) {
    console.error("Expected customer not found in access list:", expectedCustomerId);
    console.error("Actual access:", JSON.stringify(customerAccess, null, 2));
    throw new Error("Expected customer not found in customer_access");
  }

  console.log("  Customer ID:", customerAccess[0].customer_id);
  console.log("  Address Access:", customerAccess[0].address_access);
  console.log("  Auto-assignment VERIFIED");

  return customerAccess;
}

async function main() {
  console.log("==========================================");
  console.log("  E2E TEST: Portal User Flow (DFL Tenant)");
  console.log("==========================================");
  console.log("Tenant: dfl-eventi-it");
  console.log("Base URL:", BASE_URL);
  console.log("Timestamp:", TIMESTAMP);

  try {
    // Step 1: Create Portal User
    const portalUser = await step1_createPortalUser();

    // Step 2: Login
    const token = await step2_portalUserLogin(portalUser.username);

    // Step 3: Create Customer with Address
    const customer = await step3_createCustomer(token);

    // Step 4: Add Another Address
    await step4_addAddress(token, customer.customer_id);

    // Step 5: Verify portal user now has customer access
    await step5_verifyCustomerAccess(portalUser.portal_user_id, customer.customer_id);

    console.log("\n==========================================");
    console.log("  E2E TEST PASSED! (DFL Tenant)");
    console.log("==========================================");
    console.log("\nSummary:");
    console.log("  Tenant: dfl-eventi-it");
    console.log("  Portal User:", portalUser.portal_user_id);
    console.log("  Customer:", customer.customer_id);
    console.log("  Addresses: 2");
    console.log("  Customer Access: Auto-assigned");
  } catch (error) {
    console.error("\n==========================================");
    console.error("  E2E TEST FAILED! (DFL Tenant)");
    console.error("==========================================");
    console.error(error);
    process.exit(1);
  }
}

main();
