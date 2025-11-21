/**
 * Sync 10 products to Solr with all enabled languages
 * Run with: npx tsx scripts/sync-10-products.ts
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { PIMProductModel } from "../src/lib/db/models/pim-product";
import { LanguageModel } from "../src/lib/db/models/language";
import { SolrAdapter } from "../src/lib/adapters/solr-adapter";
import { projectConfig } from "../src/config/project.config";

async function syncProducts() {
  try {
    console.log("📦 Syncing 10 products to Solr with all enabled languages...\n");
    await connectToDatabase();

    // Get enabled languages
    const enabledLanguages = await LanguageModel.find({
      isEnabled: true,
      searchEnabled: true
    })
      .select("code name")
      .lean();

    console.log("🌍 Enabled languages for search:");
    enabledLanguages.forEach(lang => {
      console.log(`  - ${lang.code.toUpperCase()}: ${lang.name}`);
    });
    console.log();

    // Get 10 current products
    const products = await PIMProductModel.find({ isCurrent: true })
      .limit(10)
      .lean();

    console.log(`📋 Found ${products.length} products to sync\n`);

    if (products.length === 0) {
      console.log("⚠️  No products found in database. Please import products first.");
      process.exit(0);
    }

    // Initialize Solr adapter
    const SOLR_HOST = process.env.SOLR_HOST || "localhost";
    const SOLR_PORT = process.env.SOLR_PORT || "8983";
    const solrUrl = `http://${SOLR_HOST}:${SOLR_PORT}/solr`;

    const solrAdapter = new SolrAdapter({
      solrUrl,
      solrCore: projectConfig.solrCore,
    });

    console.log(`🔍 Solr URL: ${solrUrl}/${projectConfig.solrCore}\n`);
    console.log("🔄 Syncing products to Solr using bulk index...\n");

    // Use bulkIndexProducts method
    const result = await solrAdapter.bulkIndexProducts(products as any[], {
      batchSize: 10
    });

    console.log("\n📊 Sync Results:");
    console.log(`  Total: ${result.total}`);
    console.log(`  Successful: ${result.successful}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Skipped: ${result.skipped}`);

    if (result.errors && result.errors.length > 0) {
      console.log("\n❌ Errors:");
      result.errors.forEach(err => {
        console.log(`  - ${err}`);
      });
    }

    // Verify in Solr
    console.log("\n🔍 Verifying in Solr...");
    const query = "*:*";
    const verifyUrl = `${solrUrl}/${projectConfig.solrCore}/select?q=${query}&rows=0`;
    const response = await fetch(verifyUrl);
    const data = await response.json();

    console.log(`✅ Total documents in Solr: ${data.response.numFound}`);

    console.log("\n✅ Done! Products synced successfully.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

syncProducts();
