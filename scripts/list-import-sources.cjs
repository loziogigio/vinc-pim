/**
 * List Import Sources
 * Check what import sources exist in the database
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.VINC_MONGO_URL || "mongodb://admin:admin@localhost:27017/?authSource=admin";
const MONGODB_DB = process.env.VINC_MONGO_DB || "hdr-api-it";

async function listSources() {
  console.log("🔌 Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to database:", MONGODB_DB, "\n");

    const db = client.db(MONGODB_DB);
    const sources = await db.collection("import_sources").find({}).toArray();

    console.log(`Found ${sources.length} import sources:\n`);
    sources.forEach((s, i) => {
      console.log(`${i + 1}. ${s.source_name} (${s.source_id})`);
      console.log(`   Wholesaler: ${s.wholesaler_id}`);
      console.log(`   Type: ${s.source_type}`);
      console.log(`   Auto-publish: ${s.auto_publish_enabled}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

listSources().catch(console.error);
