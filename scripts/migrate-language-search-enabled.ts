/**
 * Migration Script: Add searchEnabled field to existing language documents
 * Run with: npx tsx scripts/migrate-language-search-enabled.ts
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function migrateLanguages() {
  try {
    console.log("🔄 Connecting to database...");
    await connectToDatabase();

    console.log("\n📋 Updating all language documents with searchEnabled field...");

    // Update all documents that don't have searchEnabled field
    const result = await LanguageModel.updateMany(
      { searchEnabled: { $exists: false } },
      { $set: { searchEnabled: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} language documents`);

    // Display all languages with their status
    const languages = await LanguageModel.find({}).sort({ order: 1 });
    console.log("\n📊 Current language status:");
    console.table(languages.map(l => ({
      code: l.code,
      name: l.name,
      isEnabled: l.isEnabled,
      searchEnabled: l.searchEnabled
    })));

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateLanguages();
