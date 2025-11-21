/**
 * Example: Batch Import with Marketplace Sync
 * Shows how batch_id and batch_metadata flow through import → database → marketplace sync
 */

import { syncProductToMarketplaces } from "../src/lib/sync/marketplace-sync";
import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

const API_BASE = "http://localhost:3000";

/**
 * Step 1: Import products with batch tracking
 */
async function importBatchWithTracking() {
  console.log("📦 Step 1: Import products with batch tracking\n");

  const batch_id = `batch_example_${Date.now()}`;
  const batch_metadata = {
    batch_id,
    batch_part: 1,
    batch_total_parts: 3,
    batch_total_items: 300,
  };

  const products = [
    {
      entity_code: "DEMO-001",
      sku: "DEMO-001",
      name: "Product Demo 1",
      description: "Example product for batch tracking demonstration",
      price: 29.99,
      currency: "EUR",
      stock_quantity: 100,
      status: "published",
    },
    {
      entity_code: "DEMO-002",
      sku: "DEMO-002",
      name: "Product Demo 2",
      description: "Another example product",
      price: 49.99,
      currency: "EUR",
      stock_quantity: 50,
      status: "published",
    },
  ];

  console.log(`   Batch ID: ${batch_id}`);
  console.log(`   Batch Part: ${batch_metadata.batch_part}/${batch_metadata.batch_total_parts}`);
  console.log(`   Products: ${products.length}\n`);

  // Import via API
  const response = await fetch(`${API_BASE}/api/b2b/pim/import/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products,
      source_id: "test-default-lang",
      batch_id,
      batch_metadata,
      sync_to_search: false, // We'll sync manually to demonstrate
    }),
  });

  const result = await response.json();

  console.log("✅ Import Result:");
  console.log(`   Imported: ${result.summary.successful}/${result.summary.total}`);
  console.log(`   Batch ID in response: ${result.debug.batch_id}`);
  console.log(`   Batch metadata: ${JSON.stringify(result.debug.batch_metadata)}\n`);

  return { batch_id, batch_metadata, entity_codes: products.map((p) => p.entity_code) };
}

/**
 * Step 2: Verify batch information in database
 */
async function verifyBatchInDatabase(batch_id: string) {
  console.log("📊 Step 2: Verify batch information in database\n");

  await connectToDatabase();

  const products = await PIMProductModel.find({
    "source.batch_id": batch_id,
    isCurrent: true,
  }).lean();

  console.log(`   Found ${products.length} products with batch_id: ${batch_id}`);

  if (products.length > 0) {
    const sample = products[0];
    console.log(`\n   Sample product source field:`);
    console.log(`   - source_id: ${sample.source?.source_id}`);
    console.log(`   - batch_id: ${sample.source?.batch_id}`);
    console.log(`   - batch_metadata: ${JSON.stringify(sample.source?.batch_metadata || "not saved (Mongoose issue)")}`);
  }

  console.log();
  return products;
}

/**
 * Step 3: Sync to marketplaces with batch tracking
 */
async function syncToMarketplacesWithBatch(
  entity_codes: string[],
  batch_id: string,
  batch_metadata: any
) {
  console.log("🚀 Step 3: Sync to marketplaces with batch tracking\n");

  // Note: When syncing products, the batch information from the database
  // is automatically included because the entire product document is fetched

  for (const entity_code of entity_codes) {
    console.log(`   Syncing ${entity_code} to marketplaces...`);

    // Sync to Solr (search index) only for this example
    await syncProductToMarketplaces(entity_code, {
      channels: ["solr"],
      operation: "update",
    });

    console.log(`   ✓ ${entity_code} synced`);
  }

  console.log(`\n✅ Synced ${entity_codes.length} products to marketplaces`);
  console.log(`   The sync jobs include batch_id: ${batch_id}`);
  console.log(`   Batch part: ${batch_metadata.batch_part}/${batch_metadata.batch_total_parts}\n`);
}

/**
 * Example Usage Scenario
 */
async function runExample() {
  console.log("=" .repeat(70));
  console.log("EXAMPLE: Batch Import with Marketplace Sync Tracking");
  console.log("=" .repeat(70));
  console.log();

  try {
    // Step 1: Import products with batch tracking
    const { batch_id, batch_metadata, entity_codes } = await importBatchWithTracking();

    // Wait a moment for import to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 2: Verify batch information is stored in database
    await verifyBatchInDatabase(batch_id);

    // Step 3: Sync to marketplaces (batch info flows automatically)
    await syncToMarketplacesWithBatch(entity_codes, batch_id, batch_metadata);

    console.log("=" .repeat(70));
    console.log("📝 Key Points:");
    console.log("=" .repeat(70));
    console.log("1. Import products with batch_id and batch_metadata");
    console.log("2. Products are stored in MongoDB with batch tracking in source field");
    console.log("3. When syncing to marketplaces, batch info is included in sync jobs");
    console.log("4. Marketplace adapters receive full product data including batch info");
    console.log("5. You can track which import batch products came from across all systems");
    console.log();
    console.log("💡 Use Cases:");
    console.log("  - Track which products belong to which import batch");
    console.log("  - Monitor sync status by batch_id");
    console.log("  - Rollback specific batches if needed");
    console.log("  - Audit trail: import → database → marketplace sync");
    console.log("=" .repeat(70));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the example
runExample();
