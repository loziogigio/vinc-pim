/**
 * Check current language configuration
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function checkStatus() {
  try {
    console.log("🔍 Checking language configuration...\n");
    await connectToDatabase();

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
