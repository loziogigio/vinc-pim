require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');
const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

(async()=>{
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  console.log('Database:', dbName);
  const sources = await db.collection('import_sources').find({}).toArray();
  console.log('Total sources:', sources.length);
  console.log('');
  sources.forEach(s => {
    console.log('Source:', s.source_id);
    console.log('  has field_mapping (old):', s.field_mapping !== undefined);
    console.log('  has field_mappings (new):', s.field_mappings !== undefined);
    if (s.field_mapping) {
      console.log('  field_mapping value:', Array.isArray(s.field_mapping) ? `array[${s.field_mapping.length}]` : typeof s.field_mapping);
    }
    if (s.field_mappings) {
      console.log('  field_mappings value:', Object.keys(s.field_mappings).length + ' mappings');
    }
    console.log('');
  });
  await client.close();
})().catch(console.error);
