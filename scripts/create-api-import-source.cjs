/**
 * Create API Import Source
 * Run this script to set up a source for API-based imports
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { MongoClient } = require("mongodb");

// Get MongoDB URI and database name from environment or use defaults
const MONGODB_URI = process.env.VINC_MONGO_URL || "mongodb://admin:admin@localhost:27017/?authSource=admin";
const MONGODB_DB = process.env.VINC_MONGO_DB || "hdr-api-it";

async function createApiSource() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   Database: ${MONGODB_DB}\n`);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected!\n");

    const db = client.db(MONGODB_DB);
    const importSources = db.collection("import_sources");

    // Check if source already exists
    const existing = await importSources.findOne({ source_id: "api-supplier-1" });

    if (existing) {
      console.log("ℹ️  API import source already exists:");
      console.log(JSON.stringify(existing, null, 2));
      return;
    }

    // Create new API source
    const source = {
      wholesaler_id: "wholesaler-1",
      source_id: "api-supplier-1",
      source_name: "API Import Source",
      source_type: "api",
      field_mappings: {
        // Direct mapping - column names match PIM fields
        sku: "sku",
        name: "name",
        description: "description",
        price: "price",
        sale_price: "sale_price",
        category: "category",
        subcategory: "subcategory",
        brand: "brand",
        stock: "stock",
        weight: "weight",
        dimensions: "dimensions",
        color: "color",
        material: "material",
        model: "model",
        warranty_months: "warranty_months",
        features: "features",
        images: "images",
      },
      auto_publish_enabled: true,
      min_score_threshold: 60,
      required_fields: ["name", "price", "category"],
      stats: {
        total_imports: 0,
        total_products: 0,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await importSources.insertOne(source);

    console.log("✅ API import source created successfully!\n");
    console.log("Source Details:");
    console.log("  - Source ID:", source.source_id);
    console.log("  - Source Name:", source.source_name);
    console.log("  - Source Type:", source.source_type);
    console.log("  - Wholesaler ID:", source.wholesaler_id);
    console.log("  - Auto-publish:", source.auto_publish_enabled);
    console.log("  - Min Score:", source.min_score_threshold);
    console.log("\n✨ You can now import products via API!");
    console.log("\nTest it with:");
    console.log("  ./test-data/test-api-import.sh\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createApiSource().catch(console.error);
