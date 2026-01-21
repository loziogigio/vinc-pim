/**
 * Sync Solr Schema with Enabled Languages
 * Ensures Solr has all necessary fields for currently enabled languages
 *
 * Usage: pnpm solr:schema
 */

import 'dotenv/config';
import { syncSolrSchemaWithLanguages } from "../services/solr-schema.service";
import { SolrAdapter } from "../lib/adapters";
import { connectWithModels, disconnectAll } from "../lib/db/connection";
import { getSolrConfig, isSolrEnabled } from "../config/project.config";

async function main() {
  try {
    console.log("🔄 Solr Schema Sync Tool\n");

    // Get tenant ID from environment
    const tenantId = process.env.VINC_TENANT_ID;
    if (!tenantId) {
      console.error('❌ VINC_TENANT_ID environment variable is required');
      console.error('   Usage: VINC_TENANT_ID=hidros-it pnpm run solr:schema');
      process.exit(1);
    }

    const dbName = `vinc-${tenantId}`;

    // Connect to MongoDB using centralized connection (single source of truth)
    const { Language } = await connectWithModels(dbName);
    console.log(`✓ Connected to MongoDB: ${dbName}\n`);

    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      console.error('❌ Solr adapter is not enabled. Set SOLR_ENABLED=true');
      process.exit(1);
    }

    // Get Solr config from projectConfig (single source of truth)
    const config = getSolrConfig();
    const solrUrl = config.url;
    const solrCore = config.core;
    console.log(`  Solr URL: ${solrUrl}`);
    console.log(`  Solr Core: ${solrCore}`);

    // Create adapter with proper config
    const solrAdapter = new SolrAdapter({
      enabled: true,
      custom_config: {
        solr_url: solrUrl,
        solr_core: solrCore,
      },
    });

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
    const enabledLanguages = await Language.find({ isEnabled: true }).sort({ order: 1 });

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
