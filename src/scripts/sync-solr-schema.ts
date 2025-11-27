/**
 * Sync Solr Schema with Enabled Languages
 * Ensures Solr has all necessary fields for currently enabled languages
 *
 * Usage: pnpm solr:schema
 */

import 'dotenv/config';
import mongoose from "mongoose";
import { LanguageModel } from "../lib/db/models/language";
import { syncSolrSchemaWithLanguages } from "../services/solr-schema.service";
import { SolrAdapter, loadAdapterConfigs } from "../lib/adapters";
import { connectToDatabase, disconnectAll } from "../lib/db/connection";

async function main() {
  try {
    console.log("🔄 Solr Schema Sync Tool\n");

    // Connect to MongoDB using centralized connection (single source of truth)
    await connectToDatabase();
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`✓ Connected to MongoDB: ${dbName}\n`);

    // Initialize Solr adapter (config from loadAdapterConfigs - single source of truth)
    const adapterConfigs = loadAdapterConfigs();
    const solrConfig = adapterConfigs.solr;

    if (!solrConfig?.enabled) {
      console.error('❌ Solr adapter is not enabled. Set SOLR_ENABLED=true');
      process.exit(1);
    }

    const solrUrl = solrConfig.custom_config?.solr_url;
    const solrCore = solrConfig.custom_config?.solr_core;
    console.log(`  Solr URL: ${solrUrl}`);
    console.log(`  Solr Core: ${solrCore}`);

    const solrAdapter = new SolrAdapter(solrConfig);

    // Ensure Solr collection exists (creates if missing)
    try {
      const { exists, created } = await solrAdapter.ensureCollection();
      if (created) {
        console.log(`✓ Created Solr collection: ${solrCore}`);
      } else if (exists) {
        console.log('✓ Solr collection exists\n');
      }
    } catch (error: any) {
      console.error('❌ Failed to connect to Solr:', error.message);
      console.error('   Make sure Solr is running and accessible');
      process.exit(1);
    }

    // Get all enabled languages
    const enabledLanguages = await LanguageModel.find({ isEnabled: true }).sort({ order: 1 });

    console.log(`Found ${enabledLanguages.length} enabled languages:`);
    enabledLanguages.forEach(lang => {
      console.log(`  - ${lang.code} (${lang.name}) - ${lang.solrAnalyzer}`);
    });

    if (enabledLanguages.length === 0) {
      console.log("\n⚠️  No enabled languages found. Run seed-languages.ts first.");
      return;
    }

    // Sync with Solr
    await syncSolrSchemaWithLanguages(enabledLanguages);

    console.log("\n✅ Solr schema sync complete!");
    console.log("\nNext steps:");
    console.log(`1. Verify Solr schema at: ${solrUrl}/#/${solrCore}/schema`);
    console.log("2. Run: pnpm solr:resync  (to reindex products)\n");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("\nCould not connect to Solr. Is it running?");
    }
    process.exit(1);
  } finally {
    await disconnectAll();
  }
}

// ES module entry point
main().then(() => process.exit(0));

export { main as syncSolrSchema };
