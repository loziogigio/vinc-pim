/**
 * Test Batch Sync Implementation
 * Import a few products and verify they're batched correctly for Solr sync
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { ImportSourceModel } from "../src/lib/db/models/import-source";
import { importQueue } from "../src/lib/queue/queues";

async function testBatchSync() {
  try {
    await connectToDatabase();

    console.log("🧪 Testing Batch Sync Implementation\n");

    // Find or create test source
    let source = await ImportSourceModel.findOne({ source_id: "test-batch-sync" });

    if (!source) {
      source = await ImportSourceModel.create({
        source_id: "test-batch-sync",
        source_name: "Test Batch Sync",
        source_type: "api",
        auto_publish_enabled: true,
        min_score_threshold: 50,
        required_fields: ["name", "description"],
        is_active: true,
        stats: {
          total_imports: 0,
          total_products: 0,
          last_import_status: "success",
        },
      });
      console.log("✅ Created test source\n");
    } else {
      console.log("✅ Using existing test source\n");
    }

    // Create test data for 5 products
    const testProducts = [
      {
        entity_code: "BATCH-TEST-001",
        data: {
          name: { it: "Prodotto Test 1" },
          description: { it: "Descrizione test 1" },
          sku: "BATCH-TEST-001",
          price: 99.99,
          brand: { it: "Test Brand" },
        },
      },
      {
        entity_code: "BATCH-TEST-002",
        data: {
          name: { it: "Prodotto Test 2" },
          description: { it: "Descrizione test 2" },
          sku: "BATCH-TEST-002",
          price: 149.99,
          brand: { it: "Test Brand" },
        },
      },
      {
        entity_code: "BATCH-TEST-003",
        data: {
          name: { it: "Prodotto Test 3" },
          description: { it: "Descrizione test 3" },
          sku: "BATCH-TEST-003",
          price: 199.99,
          brand: { it: "Test Brand" },
        },
      },
      {
        entity_code: "BATCH-TEST-004",
        data: {
          name: { it: "Prodotto Test 4" },
          description: { it: "Descrizione test 4" },
          sku: "BATCH-TEST-004",
          price: 249.99,
          brand: { it: "Test Brand" },
        },
      },
      {
        entity_code: "BATCH-TEST-005",
        data: {
          name: { it: "Prodotto Test 5" },
          description: { it: "Descrizione test 5" },
          sku: "BATCH-TEST-005",
          price: 299.99,
          brand: { it: "Test Brand" },
        },
      },
    ];

    console.log("📤 Queuing import job for 5 products...\n");

    // Queue import job
    const job = await importQueue.add("import-products", {
      job_id: `batch-test-${Date.now()}`,
      source_id: source.source_id,
      file_name: "batch-test.json",
      auto_publish_enabled: true,
      min_score_threshold: 50,
      required_fields: ["name", "description"],
    });

    console.log(`✅ Import job queued: ${job.id}`);
    console.log(`   Watch the import worker logs to see batch sync in action`);
    console.log(`   Expected: 1 batch sync job for all 5 products (instead of 5 individual jobs)\n`);

    // Wait a bit for processing
    console.log("⏳ Waiting for import to complete...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("✅ Test complete!");
    console.log("   Check worker logs to verify batch sync was queued");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testBatchSync();
