/**
 * Enable 10 languages for data entry and search indexing
 * Usage:
 *   npx tsx scripts/enable-10-languages.ts
 *   npx tsx scripts/enable-10-languages.ts --tenant dfl-eventi-it
 *   npx tsx scripts/enable-10-languages.ts --tenant hidros-it
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";
import { addLanguageFieldsToSolr, ensureBaseFields } from "../src/services/solr-schema.service";
import { refreshLanguageCache } from "../src/services/language.service";

// Top 10 languages to enable (besides Italian which is already enabled)
const LANGUAGES_TO_ENABLE = [
  "en", // English
  "de", // German
  "fr", // French
  "es", // Spanish
  "pt", // Portuguese
  "nl", // Dutch
  "pl", // Polish
  "ru", // Russian
  "zh", // Chinese
  "ja", // Japanese
];

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

async function enableLanguages() {
  try {
    const { tenant } = parseArgs();
    const tenantDb = tenant ? `vinc-${tenant}` : undefined;

    console.log("🌍 Enabling 10 languages for PIM and Search...");
    if (tenant) {
      console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);
    } else {
      console.log("📍 Using default database from environment\n");
    }

    await connectToDatabase(tenantDb);

    // Ensure base fields exist in Solr first
    console.log("📋 Step 1: Ensuring base Solr fields exist...");
    await ensureBaseFields();
    console.log("✅ Base fields ready\n");

    let enabledCount = 0;
    let searchEnabledCount = 0;
    const results = [];

    for (const code of LANGUAGES_TO_ENABLE) {
      console.log(`\n🔄 Processing language: ${code.toUpperCase()}`);

      // Find language
      const language = await LanguageModel.findOne({ code });

      if (!language) {
        console.log(`  ⚠️  Language '${code}' not found in database - skipping`);
        results.push({ code, status: "not_found" });
        continue;
      }

      console.log(`  Found: ${language.name} (${language.nativeName})`);

      // Enable language for data entry if not already enabled
      if (!language.isEnabled) {
        language.isEnabled = true;
        await language.save();
        console.log(`  ✅ Enabled for data entry`);
        enabledCount++;
      } else {
        console.log(`  ℹ️  Already enabled for data entry`);
      }

      // Enable search indexing if not already enabled
      if (!language.searchEnabled) {
        try {
          // Add Solr fields for this language
          console.log(`  🔍 Adding Solr schema fields for ${code}...`);
          await addLanguageFieldsToSolr(language);

          // Enable search in database
          language.searchEnabled = true;
          await language.save();

          console.log(`  ✅ Search indexing enabled`);
          searchEnabledCount++;
          results.push({
            code,
            name: language.name,
            status: "enabled_both",
            dataEntry: true,
            searchEnabled: true
          });
        } catch (solrError: any) {
          console.log(`  ❌ Solr schema update failed: ${solrError.message}`);
          results.push({
            code,
            name: language.name,
            status: "solr_failed",
            dataEntry: language.isEnabled,
            searchEnabled: false,
            error: solrError.message
          });
        }
      } else {
        console.log(`  ℹ️  Search already enabled`);
        results.push({
          code,
          name: language.name,
          status: "already_enabled",
          dataEntry: true,
          searchEnabled: true
        });
      }
    }

    // Refresh cache
    console.log("\n🔄 Refreshing language cache...");
    await refreshLanguageCache();
    console.log("✅ Cache refreshed");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total languages processed: ${LANGUAGES_TO_ENABLE.length}`);
    console.log(`Newly enabled for data entry: ${enabledCount}`);
    console.log(`Newly enabled for search: ${searchEnabledCount}`);
    console.log("\n📋 Results:");
    console.table(results);

    // Verify in database
    console.log("\n🔍 Verifying final state in database...");
    const enabledLanguages = await LanguageModel.find({
      isEnabled: true,
      code: { $in: [...LANGUAGES_TO_ENABLE, "it"] }
    }).select("code name searchEnabled");

    console.log("\n✅ Enabled languages:");
    console.table(enabledLanguages.map(l => ({
      code: l.code,
      name: l.name,
      searchEnabled: l.searchEnabled
    })));

    console.log("\n✅ Done! All languages are ready for use.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

enableLanguages();
