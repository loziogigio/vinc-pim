/**
 * Test the exact logic used by disable-search API
 */

import { connectToDatabase, getCurrentDatabase } from "../src/lib/db/connection";
import { LanguageModel } from "../src/lib/db/models/language";

async function testApiLogic() {
  try {
    console.log("🧪 Testing disable-search API logic...\n");

    // Exactly what the API does
    await connectToDatabase();

    console.log("📊 Current database:", getCurrentDatabase());

    const code = "it";

    // Find language (exactly as API does)
    const language = await LanguageModel.findOne({ code });

    console.log("\n1️⃣ Language found:");
    console.log({
      _id: language?._id,
      code: language?.code,
      name: language?.name,
      isEnabled: language?.isEnabled,
      searchEnabled: language?.searchEnabled
    });

    // Check if already disabled (exactly as API does)
    if (!language?.searchEnabled) {
      console.log("\n❌ API would return: 'Search indexing for 'it' is already disabled'");
      console.log("   searchEnabled value:", language?.searchEnabled);
      console.log("   Type of searchEnabled:", typeof language?.searchEnabled);
    } else {
      console.log("\n✅ API would proceed to disable search");
      console.log("   searchEnabled value:", language?.searchEnabled);
    }

    // Check mongoose connection details
    console.log("\n2️⃣ Mongoose connection info:");
    const mongoose = require("mongoose");
    console.log({
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.db?.databaseName,
      host: mongoose.connection.host,
      models: Object.keys(mongoose.connection.models)
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testApiLogic();
