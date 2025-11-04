/**
 * Migration: Convert ALL field_mapping to field_mappings
 * This runs on ALL sources regardless of current state
 */

require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');

const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

(async()=>{
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  const collection = db.collection('import_sources');

  console.log('🔍 Finding all sources with field_mapping...');

  const sources = await collection.find({ field_mapping: { $exists: true } }).toArray();

  console.log(`Found ${sources.length} sources with old field_mapping field\n`);

  for (const source of sources) {
    console.log(`Migrating: ${source.source_id}`);

    // Convert array to object
    const mappingsObj = {};
    if (Array.isArray(source.field_mapping)) {
      source.field_mapping.forEach(m => {
        if (!mappingsObj[m.source_field]) {
          mappingsObj[m.source_field] = m.pim_field;
        }
      });
    }

    // Update: add field_mappings and remove field_mapping
    await collection.updateOne(
      { _id: source._id },
      {
        $set: { field_mappings: mappingsObj },
        $unset: { field_mapping: "" }
      }
    );

    console.log(`  ✅ Migrated ${Object.keys(mappingsObj).length} mappings`);
  }

  // Also ensure all sources have field_mappings (even if empty)
  console.log('\n🔍 Ensuring all sources have field_mappings field...');
  const result = await collection.updateMany(
    { field_mappings: { $exists: false } },
    { $set: { field_mappings: {} } }
  );

  console.log(`  ✅ Added field_mappings to ${result.modifiedCount} sources`);

  console.log('\n✅ Migration complete!');
  await client.close();
})().catch(console.error);
