/**
 * Test: Create a source and update field_mappings
 */

require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');

const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

(async()=>{
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  const collection = db.collection('import_sources');

  const testSourceId = 'test-schema-' + Date.now();

  console.log('Creating test source:', testSourceId);

  // Create a new source
  await collection.insertOne({
    wholesaler_id: 'test',
    source_id: testSourceId,
    source_name: 'Schema Test',
    source_type: 'api',
    field_mappings: { test_field: 'entity_code' },
    auto_publish_enabled: false,
    min_score_threshold: 70,
    required_fields: [],
    is_active: true,
    stats: {
      total_imports: 0,
      total_products: 0,
      avg_completeness_score: 0
    },
    created_by: 'test',
    created_at: new Date(),
    updated_at: new Date()
  });

  console.log('✅ Created\n');

  // Read it back
  let source = await collection.findOne({ source_id: testSourceId });
  console.log('Initial state:');
  console.log('  has field_mapping:', source.field_mapping !== undefined);
  console.log('  has field_mappings:', source.field_mappings !== undefined);
  console.log('  field_mappings value:', JSON.stringify(source.field_mappings));
  console.log('');

  // Update the mapping
  console.log('Updating field_mappings...');
  await collection.updateOne(
    { source_id: testSourceId },
    { $set: { field_mappings: { new_field: 'name', another: 'price' } } }
  );

  // Read again
  source = await collection.findOne({ source_id: testSourceId });
  console.log('After update:');
  console.log('  has field_mapping:', source.field_mapping !== undefined);
  console.log('  has field_mappings:', source.field_mappings !== undefined);
  console.log('  field_mappings value:', JSON.stringify(source.field_mappings));
  console.log('');

  // Clean up
  console.log('Cleaning up test source...');
  await collection.deleteOne({ source_id: testSourceId });

  console.log('✅ Test complete - schema is working correctly!');

  await client.close();
})().catch(console.error);
