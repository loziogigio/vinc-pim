/**
 * Example: Import with Channel-Specific Metadata
 * Demonstrates passing tenant_id for B2B and store_id for B2C
 */

const API_BASE = "http://localhost:3000";

/**
 * Import products with channel-specific metadata
 */
async function importWithChannelMetadata() {
  console.log("📦 Importing products with channel metadata\n");

  const batch_id = `batch_multichannel_${Date.now()}`;

  const products = [
    {
      entity_code: "TENANT-PRODUCT-001",
      sku: "TENANT-PRODUCT-001",
      name: "Multi-tenant Product",
      description: "This product will be synced with tenant/store identifiers",
      price: 299.99,
      wholesale_price: 249.99,
      currency: "EUR",
      stock_quantity: 100,
      status: "published",
    },
  ];

  // Import with channel-specific metadata
  const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products,
      source_id: "test-default-lang",
      batch_id,
      batch_metadata: {
        batch_id,
        batch_part: 1,
        batch_total_parts: 1,
        batch_total_items: products.length,
      },

      // Channel-specific metadata (PLACEHOLDER - not yet implemented)
      channel_metadata: {
        b2b: {
          tenant_id: "tenant_wholesale_001", // Single B2B tenant
        },
        b2c: {
          store_id: ["store_italy_001", "store_spain_001", "store_france_001"], // Multiple B2C stores
        },
        amazon: {
          marketplace_id: ["A11IL2PNWYJU7H", "A1PA6795UKMFR9"], // Italy & Germany
          seller_id: "A1234567890123",
        },
        ebay: {
          marketplace_id: ["EBAY-IT", "EBAY-DE", "EBAY-FR"], // Multiple eBay marketplaces
          account_id: "my_business_account",
        },
      },
    }),
  });

  const result = await response.json();

  console.log("✅ Import Response:");
  console.log(`   Success: ${result.success}`);
  console.log(`   Job ID: ${result.job_id}`);
  console.log(`   Imported: ${result.summary.successful}/${result.summary.total}`);
  console.log("\n📋 Debug Info:");
  console.log(`   Batch ID: ${result.debug.batch_id}`);
  console.log(`   Channel Metadata:`, JSON.stringify(result.debug.channel_metadata, null, 2));
  console.log();

  return result;
}

/**
 * Use Cases for Channel Metadata
 */
function demonstrateUseCases() {
  console.log("=".repeat(70));
  console.log("USE CASES FOR CHANNEL METADATA");
  console.log("=".repeat(70));
  console.log();

  console.log("1. MULTI-TENANT B2B:");
  console.log("   - Import products for specific tenant");
  console.log("   - Tenant: 'tenant_wholesale_001'");
  console.log("   - Product syncs to B2B storefront with tenant isolation");
  console.log("   - Each tenant sees only their products\n");

  console.log("2. MULTI-STORE B2C:");
  console.log("   - Import products for multiple stores");
  console.log("   - Stores: ['store_italy_001', 'store_spain_001', 'store_france_001']");
  console.log("   - Product syncs to all specified B2C stores");
  console.log("   - Each store can have different pricing/inventory");
  console.log("   - Use array for products available in multiple stores\n");

  console.log("3. MULTI-MARKETPLACE:");
  console.log("   - Same product, different marketplace configurations");
  console.log("   - Amazon Italy: marketplace_id = 'A11IL2PNWYJU7H'");
  console.log("   - eBay Italy: marketplace_id = 'EBAY-IT'");
  console.log("   - Each marketplace has its own rules and formatting\n");

  console.log("4. SELLER ACCOUNTS:");
  console.log("   - Multiple seller accounts on same marketplace");
  console.log("   - Amazon seller_id: 'A1234567890123'");
  console.log("   - eBay account_id: 'my_business_account'");
  console.log("   - Products route to correct seller account\n");

  console.log("=".repeat(70));
  console.log();
}

/**
 * Example: Multi-Tenant Product Import
 */
async function multiTenantExample() {
  console.log("=".repeat(70));
  console.log("EXAMPLE: Multi-Tenant Product Import");
  console.log("=".repeat(70));
  console.log();

  // Tenant A - Wholesale Electronics
  console.log("📦 Importing for Tenant A (Wholesale Electronics)...");
  await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          entity_code: "TENANT-A-001",
          name: "Professional Drill",
          price: 199.99,
          wholesale_price: 149.99,
        },
      ],
      source_id: "test-default-lang",
      channel_metadata: {
        b2b: { tenant_id: "tenant_electronics_wholesale" },
      },
    }),
  });
  console.log("   ✓ Imported for tenant_electronics_wholesale\n");

  // Tenant B - Wholesale Home & Garden
  console.log("📦 Importing for Tenant B (Wholesale Home & Garden)...");
  await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          entity_code: "TENANT-B-001",
          name: "Garden Hose Set",
          price: 49.99,
          wholesale_price: 34.99,
        },
      ],
      source_id: "test-default-lang",
      channel_metadata: {
        b2b: { tenant_id: "tenant_garden_wholesale" },
      },
    }),
  });
  console.log("   ✓ Imported for tenant_garden_wholesale\n");

  console.log("Result:");
  console.log("  - Each tenant sees only their own products");
  console.log("  - Tenant isolation at the B2B storefront level");
  console.log("  - Same PIM database, different B2B tenants\n");
}

/**
 * Example: Multi-Store B2C Import
 */
async function multiStoreExample() {
  console.log("=".repeat(70));
  console.log("EXAMPLE: Multi-Store B2C Import");
  console.log("=".repeat(70));
  console.log();

  // Example 1: Single Store
  console.log("📦 Example 1: Import for single store (Italy)...");
  await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          entity_code: "PRODUCT-001",
          name: "Power Tool",
          price: 199.99,
          currency: "EUR",
        },
      ],
      source_id: "test-default-lang",
      channel_metadata: {
        b2c: { store_id: "store_italy" },  // Single store
      },
    }),
  });
  console.log("   ✓ Imported for store_italy\n");

  // Example 2: Multiple Stores (Array)
  console.log("📦 Example 2: Import for multiple stores (Italy, Spain, France)...");
  await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [
        {
          entity_code: "PRODUCT-002",
          name: "Universal Product",
          price: 149.99,
          currency: "EUR",
        },
      ],
      source_id: "test-default-lang",
      channel_metadata: {
        b2c: {
          store_id: ["store_italy", "store_spain", "store_france"]  // Multiple stores (array)
        },
      },
    }),
  });
  console.log("   ✓ Imported for 3 stores: Italy, Spain, France\n");

  console.log("Result:");
  console.log("  - Single store: Use string \"store_italy\"");
  console.log("  - Multiple stores: Use array [\"store_italy\", \"store_spain\", \"store_france\"]");
  console.log("  - Product syncs to all specified stores");
  console.log("  - Each store can have its own pricing/inventory configuration\n");
}

/**
 * Run examples
 */
async function main() {
  try {
    // Basic import with channel metadata
    await importWithChannelMetadata();

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Show use cases
    demonstrateUseCases();

    // Multi-tenant example
    await multiTenantExample();

    // Multi-store example
    await multiStoreExample();

    console.log("=".repeat(70));
    console.log("✅ EXAMPLES COMPLETED");
    console.log("=".repeat(70));
    console.log();
    console.log("Key Points:");
    console.log("  1. channel_metadata is accepted by the API");
    console.log("  2. It's logged and returned in the response");
    console.log("  3. Future: Will be passed to adapters during sync");
    console.log("  4. Use for: tenant isolation, store-specific config, marketplace routing");
    console.log();

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the examples
main();
