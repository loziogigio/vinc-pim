/**
 * Check Language Sync Status
 * Shows which languages are enabled and which need Solr sync
 *
 * Usage:
 *   npx tsx scripts/check-language-sync-status.ts --tenant hidros-it
 *   npx tsx scripts/check-language-sync-status.ts --tenant test-tenant-069948
 */

import { config } from "dotenv";
config({ path: ".env" });

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";
import { PIMProductModel } from "../src/lib/db/models/pim-product";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf('--tenant');

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

async function checkLanguageSyncStatus() {
  try {
    const { tenant } = parseArgs();

    if (!tenant) {
      console.log('\n❌ Error: --tenant parameter is required');
      console.log('\nUsage:');
      console.log('  npx tsx scripts/check-language-sync-status.ts --tenant hidros-it');
      console.log('  npx tsx scripts/check-language-sync-status.ts --tenant test-tenant-069948');
      process.exit(1);
    }

    const tenantDb = `vinc-${tenant}`;
    await connectToDatabase(tenantDb);

    console.log("📋 Language Configuration & Sync Status\n");

    // Get all languages
    const languages = await LanguageModel.find({}).sort({ order: 1 });

    if (languages.length === 0) {
      console.log("⚠️  No languages found in database");
      console.log("   Run language seeding script to initialize languages");
      process.exit(0);
    }

    console.log(`Found ${languages.length} languages:\n`);

    for (const lang of languages) {
      const statusIcon = lang.isEnabled ? "✅" : "❌";
      const searchIcon = lang.searchEnabled ? "🔍" : "⭕";
      const defaultIcon = lang.isDefault ? "⭐" : "  ";

      console.log(`${statusIcon} ${searchIcon} ${defaultIcon} ${lang.code.toUpperCase()} - ${lang.name} (${lang.nativeName})`);
      console.log(`   Enabled: ${lang.isEnabled ? "Yes" : "No"}`);
      console.log(`   Search Enabled: ${lang.searchEnabled ? "Yes" : "No"}`);
      console.log(`   Solr Analyzer: ${lang.solrAnalyzer}`);
      console.log(`   Default: ${lang.isDefault ? "Yes" : "No"}`);

      // Count products with content in this language
      if (lang.isEnabled) {
        const productsWithContent = await PIMProductModel.countDocuments({
          isCurrent: true,
          [`name.${lang.code}`]: { $exists: true, $ne: "" },
        });

        console.log(`   Products with content: ${productsWithContent}`);

        if (lang.searchEnabled) {
          // Check if products need syncing
          const unsyncedProducts = await PIMProductModel.countDocuments({
            isCurrent: true,
            status: "published",
            [`name.${lang.code}`]: { $exists: true, $ne: "" },
            "analytics.last_synced_at": { $exists: false },
          });

          console.log(`   Products need sync: ${unsyncedProducts}`);
        }
      }

      console.log("");
    }

    // Summary
    const enabledLanguages = languages.filter(l => l.isEnabled);
    const searchEnabledLanguages = languages.filter(l => l.searchEnabled);
    const defaultLanguage = languages.find(l => l.isDefault);

    console.log("📊 Summary:");
    console.log(`   Total languages: ${languages.length}`);
    console.log(`   Enabled for data entry: ${enabledLanguages.length} (${enabledLanguages.map(l => l.code).join(", ")})`);
    console.log(`   Search indexing enabled: ${searchEnabledLanguages.length} (${searchEnabledLanguages.map(l => l.code).join(", ")})`);
    console.log(`   Default language: ${defaultLanguage?.code || "not set"}`);

    // Check if Solr is enabled
    console.log(`\n🔧 Solr Configuration:`);
    console.log(`   SOLR_ENABLED: ${process.env.SOLR_ENABLED || "not set"}`);
    console.log(`   SOLR_CORE: ${process.env.SOLR_CORE || "not set"}`);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkLanguageSyncStatus();
