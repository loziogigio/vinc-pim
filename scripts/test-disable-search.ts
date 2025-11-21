/**
 * Test script to verify disable-search functionality
 * Run with: npx tsx scripts/test-disable-search.ts
 */

import { connectToDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function testDisable() {
  try {
    console.log("🔄 Connecting to database...");
    await connectToDatabase();

    const code = "it";
    console.log(`\n📋 Testing disable-search for: ${code.toUpperCase()}`);

    // Check current status
    console.log("\n1️⃣ Before disable:");
    let lang = await LanguageModel.findOne({ code });
    console.log(`  Code: ${lang?.code}`);
    console.log(`  Name: ${lang?.name}`);
    console.log(`  isEnabled: ${lang?.isEnabled}`);
    console.log(`  searchEnabled: ${lang?.searchEnabled}`);

    if (!lang?.searchEnabled) {
      console.log("\n⚠️  Search is already disabled. Enabling it first...");
      lang.searchEnabled = true;
      await lang.save();
      console.log("✅ Enabled search for testing");
    }

    // Disable search
    console.log("\n2️⃣ Disabling search...");
    const updated = await LanguageModel.findOneAndUpdate(
      { code },
      { $set: { searchEnabled: false } },
      { new: true }
    );
    console.log(`  searchEnabled: ${updated?.searchEnabled}`);
    console.log(`  updated_at: ${updated?.updated_at}`);

    // Verify by reading again
    console.log("\n3️⃣ Verify by re-reading:");
    lang = await LanguageModel.findOne({ code });
    console.log(`  searchEnabled: ${lang?.searchEnabled}`);

    if (lang?.searchEnabled === false) {
      console.log("\n✅ SUCCESS: Disable functionality works correctly!");
    } else {
      console.log("\n❌ FAILED: searchEnabled is still true");
    }

    // Re-enable for next test
    console.log("\n4️⃣ Re-enabling search for next test...");
    await LanguageModel.findOneAndUpdate(
      { code },
      { $set: { searchEnabled: true } }
    );
    console.log("✅ Re-enabled search");

    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDisable();
