/**
 * Sync Solr Schema with Enabled Languages
 * Ensures Solr has all necessary fields for currently enabled languages
 *
 * Usage: npx ts-node src/scripts/sync-solr-schema.ts
 */

import mongoose from "mongoose";
import { LanguageModel } from "../lib/db/models/language";
import { syncSolrSchemaWithLanguages } from "../services/solr-schema.service";

async function main() {
  try {
    console.log("🔄 Solr Schema Sync Tool\n");

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/pim";
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB");

    // Get all enabled languages
    const enabledLanguages = await LanguageModel.find({ isEnabled: true }).sort({ order: 1 });

    console.log(`\nFound ${enabledLanguages.length} enabled languages:`);
    enabledLanguages.forEach(lang => {
      console.log(`  - ${lang.code} (${lang.name}) - ${lang.solrAnalyzer}`);
    });

    if (enabledLanguages.length === 0) {
      console.log("\n⚠️  No enabled languages found. Run seed-languages.ts first.");
      return;
    }

    // Sync with Solr
    await syncSolrSchemaWithLanguages(enabledLanguages);

    console.log("✅ Solr schema sync complete!");
    console.log("\nNext steps:");
    console.log("1. Verify Solr schema at: http://localhost:8983/solr/#/pim-products/schema");
    console.log("2. Reindex your products to populate the new fields");
    console.log("3. Restart your application to pick up the new languages\n");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("\nCould not connect to Solr. Is it running?");
      console.error("Check: http://localhost:8983/solr/");
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().then(() => process.exit(0));
}

export { main as syncSolrSchema };
