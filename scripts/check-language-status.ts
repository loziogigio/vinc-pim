/**
 * Check current language configuration
 * Usage:
 *   npx tsx scripts/check-language-status.ts
 *   npx tsx scripts/check-language-status.ts --tenant dfl-eventi-it
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

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

async function checkStatus() {
  try {
    const { tenant } = parseArgs();
    const tenantDb = tenant ? `vinc-${tenant}` : undefined;

    console.log("🔍 Checking language configuration...");
    if (tenant) {
      console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})\n`);
    } else {
      console.log("📍 Using default database from environment\n");
    }

    await connectToDatabase(tenantDb);

    // Get all enabled languages
    const enabledLanguages = await LanguageModel.find({ isEnabled: true })
      .select("code name isEnabled searchEnabled")
      .sort({ code: 1 })
      .lean();

    console.log("📊 Enabled Languages for Data Entry:");
    console.table(enabledLanguages.map(l => ({
      Code: l.code.toUpperCase(),
      Name: l.name,
      DataEntry: l.isEnabled ? '✓' : '✗',
      SearchIndexing: l.searchEnabled ? '✓' : '✗'
    })));

    console.log(`\n✅ Total enabled for data entry: ${enabledLanguages.length}`);

    const searchEnabled = enabledLanguages.filter(l => l.searchEnabled);
    console.log(`✅ Total enabled for search: ${searchEnabled.length}`);

    if (searchEnabled.length > 0) {
      console.log("\n🔍 Search-enabled languages:");
      searchEnabled.forEach(l => {
        console.log(`  - ${l.code.toUpperCase()}: ${l.name}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkStatus();
