/**
 * Migration Script: field_mapping (array) → field_mappings (object)
 * Updates all import sources to use the new schema
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.VINC_MONGO_URL || "mongodb://admin:admin@localhost:27017/?authSource=admin";
const MONGODB_DB = process.env.VINC_MONGO_DB || "hdr-api-it";

async function migrateFieldMappings() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   Database: ${MONGODB_DB}\n`);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected!\n");

    const db = client.db(MONGODB_DB);
    const importSources = db.collection("import_sources");

    // Find all sources with old field_mapping structure
    const sources = await importSources.find({}).toArray();

    console.log(`📊 Found ${sources.length} import sources\n`);

    let migrated = 0;
    let skipped = 0;

    for (const source of sources) {
      const hasOldField = source.field_mapping !== undefined;
      const hasNewField = source.field_mappings !== undefined;

      console.log(`\n📦 Source: ${source.source_id}`);
      console.log(`   Has field_mapping (old): ${hasOldField}`);
      console.log(`   Has field_mappings (new): ${hasNewField}`);

      if (hasOldField && !hasNewField) {
        // Migrate: convert array to object
        const fieldMappingsObject = {};

        if (Array.isArray(source.field_mapping)) {
          source.field_mapping.forEach(mapping => {
            // Only keep first mapping if there are duplicates
            if (!fieldMappingsObject[mapping.source_field]) {
              fieldMappingsObject[mapping.source_field] = mapping.pim_field;
            }
          });
        }

        console.log(`   Converting ${source.field_mapping.length} mappings to new format...`);

        await importSources.updateOne(
          { _id: source._id },
          {
            $set: { field_mappings: fieldMappingsObject },
            $unset: { field_mapping: "" }
          }
        );

        console.log(`   ✅ Migrated to field_mappings object with ${Object.keys(fieldMappingsObject).length} mappings`);
        migrated++;
      } else if (hasOldField && hasNewField) {
        // Remove old field if both exist
        console.log(`   Removing old field_mapping (new field already exists)...`);
        await importSources.updateOne(
          { _id: source._id },
          { $unset: { field_mapping: "" } }
        );
        migrated++;
      } else if (hasNewField) {
        console.log(`   ✓ Already using new schema`);
        skipped++;
      } else {
        // Neither field exists - add empty field_mappings
        console.log(`   Adding empty field_mappings...`);
        await importSources.updateOne(
          { _id: source._id },
          { $set: { field_mappings: {} } }
        );
        migrated++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(60));
    console.log(`   Total sources: ${sources.length}`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Already migrated: ${skipped}`);
    console.log("=".repeat(60));
    console.log("\n✅ Migration complete!\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

migrateFieldMappings().catch(console.error);
