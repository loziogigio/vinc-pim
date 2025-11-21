/**
 * Verify batch products in MongoDB and Solr
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

async function verify() {
  await connectToDatabase();

  // Check MongoDB
  console.log("📦 MongoDB Verification:");
  const products = await PIMProductModel.find({ entity_code: /^BATCH-/ })
    .select('entity_code sku name status analytics.last_synced_at')
    .lean();

  console.log(`   Total products: ${products.length}`);

  if (products.length > 0) {
    console.log("\n📋 Products status:");
    products.forEach((p: any) => {
      const name = typeof p.name === 'string' ? p.name : (p.name?.it || 'N/A');
      const synced = p.analytics?.last_synced_at
        ? new Date(p.analytics.last_synced_at).toLocaleString()
        : '❌ Not synced';
      console.log(`   - ${p.entity_code}: ${name}`);
      console.log(`     Status: ${p.status}, Last sync: ${synced}`);
    });
  }

  // Check Solr
  console.log("\n🔍 Solr Verification:");
  const solrUrl = process.env.SOLR_URL || "http://localhost:8983/solr";
  const coreName = process.env.SOLR_CORE || process.env.MONGODB_DATABASE || "mycore";

  try {
    const response = await fetch(`${solrUrl}/${coreName}/select?q=entity_code:BATCH-*&rows=0`);
    const data = await response.json();
    console.log(`   Solr URL: ${solrUrl}`);
    console.log(`   Core: ${coreName}`);
    console.log(`   Total documents: ${data.response.numFound}`);

    if (data.response.numFound === 0) {
      console.log("\n⚠️  No products found in Solr! Products need to be synced.");
    } else if (data.response.numFound < products.length) {
      console.log(`\n⚠️  Only ${data.response.numFound} of ${products.length} products synced to Solr`);
    } else {
      console.log("\n✅ All products synced to Solr!");
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  process.exit(0);
}

verify();
