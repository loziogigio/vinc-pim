/**
 * Debug script to check Italian language state
 * Compares database vs API response
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function debug() {
  try {
    console.log("🔍 Debugging Italian language state...\n");

    await connectToDatabase();

    // Direct database query
    console.log("1️⃣ Direct MongoDB query:");
    const dbLang = await LanguageModel.findOne({ code: "it" }).lean();
    console.log({
      code: dbLang?.code,
      name: dbLang?.name,
      isEnabled: dbLang?.isEnabled,
      searchEnabled: dbLang?.searchEnabled,
      _id: dbLang?._id
    });

    // Query without .lean()
    console.log("\n2️⃣ Mongoose model query (without lean):");
    const modelLang = await LanguageModel.findOne({ code: "it" });
    console.log({
      code: modelLang?.code,
      name: modelLang?.name,
      isEnabled: modelLang?.isEnabled,
      searchEnabled: modelLang?.searchEnabled,
      _id: modelLang?._id
    });

    // All Italian languages (check for duplicates)
    console.log("\n3️⃣ All documents with code='it':");
    const allItalian = await LanguageModel.find({ code: "it" }).lean();
    console.log(`Found ${allItalian.length} document(s) with code='it'`);
    allItalian.forEach((lang, index) => {
      console.log(`\n  Document ${index + 1}:`);
      console.log({
        _id: lang._id,
        code: lang.code,
        searchEnabled: lang.searchEnabled,
        isEnabled: lang.isEnabled
      });
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  }
}

debug();
