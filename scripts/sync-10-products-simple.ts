/**
 * Sync 10 products to Solr one by one
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { LanguageModel } from "../src/lib/db/models/language";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";

async function syncProducts() {
  try {
    console.log("📦 Syncing 10 products to Solr (Italian only)...\n");
    await connectToDatabase();

    // Get enabled languages
    const enabledLanguages = await LanguageModel.find({
      isEnabled: true,
      searchEnabled: true
    }).select("code name").lean();

    console.log("🌍 Enabled languages:");
    enabledLanguages.forEach(lang => {
      console.log(`  - ${lang.code.toUpperCase()}: ${lang.name}`);
    });
    console.log();

    // Get 10 products
    const products = await PIMProductModel.find({ isCurrent: true })
      .limit(10)
      .lean();

    console.log(`📋 Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log("⚠️  No products found. Import some products first.");
      process.exit(0);
    }

    // Initialize Solr adapter
    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;
    const solrCore = process.env.VINC_MONGO_DB || "hdr-api-it";

    const solrAdapter = new SolrAdapter({
      custom_config: {
        solr_url: solrUrl,
        solr_core: solrCore,
      }
    });

    console.log(`🔍 Solr: ${solrUrl}/${solrCore}\n`);
    console.log("🔄 Syncing products...\n");

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`[${i + 1}/${products.length}] ${product.entity_code}`);
      console.log(`  SKU: ${product.sku}`);
      console.log(`  Name (IT): ${product.name?.it || 'N/A'}`);

      try {
        const result = await solrAdapter.syncProduct(product as any);
        if (result.success) {
          console.log(`  ✅ Synced`);
          successCount++;
        } else {
          console.log(`  ❌ Failed: ${result.error}`);
          failedCount++;
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
        failedCount++;
      }
      console.log();
    }

    console.log("📊 Summary:");
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);

    // Verify
    console.log("\n🔍 Verifying in Solr...");
    const verifyUrl = `${solrUrl}/${solrCore}/select?q=*:*&rows=0`;
    const response = await fetch(verifyUrl);
    const data = await response.json();
    console.log(`✅ Total documents: ${data.response.numFound}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

syncProducts();
