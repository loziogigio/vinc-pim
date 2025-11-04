/**
 * Create API Import Source WITH Field Mappings
 * This example shows how to map supplier fields to PIM standard fields
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.VINC_MONGO_URL || "mongodb://admin:admin@localhost:27017/?authSource=admin";
const MONGODB_DB = process.env.VINC_MONGO_DB || "hdr-api-it";

async function createApiSourceWithMappings() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   Database: ${MONGODB_DB}\n`);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected!\n");

    const db = client.db(MONGODB_DB);
    const importSources = db.collection("import_sources");

    // Check if source already exists
    const sourceId = "api-supplier-with-mapping";
    const existing = await importSources.findOne({ source_id: sourceId });

    if (existing) {
      console.log("ℹ️  Source already exists. Deleting and recreating...\n");
      await importSources.deleteOne({ source_id: sourceId });
    }

    // Create source with field mappings
    const source = {
      wholesaler_id: "wholesaler-1",
      source_id: sourceId,
      source_name: "API Supplier (with field mapping)",
      source_type: "api",

      // Field mappings: Supplier field → PIM standard field
      field_mappings: {
        // Core product fields
        "product_code": "entity_code",         // Supplier uses "product_code", we use "entity_code" (sku will default to entity_code)
        "product_title": "name",               // Supplier uses "product_title", we use "name"
        "long_description": "description",     // Supplier uses "long_description"
        "retail_price": "price",               // Supplier uses "retail_price"
        "promo_price": "sale_price",           // Supplier uses "promo_price"
        "product_category": "category",        // Supplier uses "product_category"

        // Additional fields
        "manufacturer": "brand",               // Supplier uses "manufacturer", we use "brand"
        "quantity_available": "stock",         // Supplier uses "quantity_available"
        "item_weight": "weight",               // Supplier uses "item_weight"
        "product_color": "color",              // Supplier uses "product_color"
        "build_material": "material",          // Supplier uses "build_material"
        "model_number": "model",               // Supplier uses "model_number"
        "guarantee_period": "warranty_months", // Supplier uses "guarantee_period"
      },

      auto_publish_enabled: true,
      min_score_threshold: 60,
      required_fields: ["name", "price", "category"],
      is_active: true,
      stats: {
        total_imports: 0,
        total_products: 0,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };

    await importSources.insertOne(source);

    console.log("✅ API import source with field mappings created successfully!\n");
    console.log("Source Details:");
    console.log("  - Source ID:", source.source_id);
    console.log("  - Source Name:", source.source_name);
    console.log("  - Auto-publish:", source.auto_publish_enabled);
    console.log("  - Min Score:", source.min_score_threshold);
    console.log("\nField Mappings:");
    console.log("  Supplier Field         →  PIM Standard Field");
    console.log("  " + "─".repeat(50));
    Object.entries(source.field_mappings).forEach(([from, to]) => {
      console.log(`  ${from.padEnd(22)} →  ${to}`);
    });

    console.log("\n✨ You can now import products via API!");
    console.log("\nThe system will:");
    console.log("  1. Map supplier fields to PIM standard fields");
    console.log("  2. Keep extra fields (like custom_field_1, supplier_notes)");
    console.log("  3. Apply auto-publish rules");
    console.log("\nTest it with:");
    console.log(`  curl -X POST http://localhost:3000/api/b2b/pim/import/api \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d @test-data/api-import-with-mapping-example.json\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createApiSourceWithMappings().catch(console.error);
