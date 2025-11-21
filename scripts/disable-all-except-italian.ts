/**
 * Disable search for all languages except Italian
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";
import { refreshLanguageCache } from "../src/services/language.service";

async function disableOtherLanguages() {
  try {
    console.log("🔧 Disabling search for all languages except Italian...\n");
    await connectToDatabase();

    // Disable search for all languages except Italian
    const result = await LanguageModel.updateMany(
      { code: { $ne: "it" } },
      { $set: { searchEnabled: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} languages\n`);

    // Refresh cache
    await refreshLanguageCache();

    // Show current status
    const languages = await LanguageModel.find({ isEnabled: true })
      .select("code name isEnabled searchEnabled")
      .sort({ code: 1 })
      .lean();

    console.log("📊 Current status of enabled languages:");
    console.table(languages.map(l => ({
      code: l.code.toUpperCase(),
      name: l.name,
      dataEntry: l.isEnabled ? 'Yes' : 'No',
      searchEnabled: l.searchEnabled ? 'Yes' : 'No'
    })));

    // Show only search-enabled languages
    const searchEnabled = languages.filter(l => l.searchEnabled);
    console.log(`\n✅ Languages with search enabled: ${searchEnabled.length}`);
    searchEnabled.forEach(l => {
      console.log(`  - ${l.code.toUpperCase()}: ${l.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

disableOtherLanguages();
