/**
 * Test Solr Sync - Queue a product for Solr indexing
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { syncQueue } from "../src/lib/queue/queues";

async function testSolrSync() {
  try {
    console.log("🔍 Testing Solr Sync...\n");
    await connectToDatabase();

    // Find one product to test
    const product = await PIMProductModel.findOne({
      entity_code: /^FULL/,
      isCurrent: true,
    });

    if (!product) {
      console.log("❌ No products found");
      process.exit(1);
    }

    console.log(`📦 Testing sync for product: ${product.entity_code}`);
    console.log(`   Name: ${product.name?.it}`);
    console.log(`   Status: ${product.status}\n`);

    // Queue sync job
    const job = await syncQueue.add("sync-product", {
      product_id: product.entity_code,
      operation: "update",
      channels: ["solr"],
    });

    console.log(`✅ Sync job queued: ${job.id}`);
    console.log(`\n💡 Check the sync worker logs to see the result`);
    console.log(`   The worker should now successfully index the product to Solr`);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testSolrSync();
