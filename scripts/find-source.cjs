require('dotenv').config({path: '.env.local'});
const {MongoClient} = require('mongodb');
const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

const sourceId = process.argv[2] || 'api-produc-fl';

(async()=>{
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  console.log('Searching in database:', dbName);
  console.log('Looking for source_id:', sourceId);
  console.log('');

  const source = await db.collection('import_sources').findOne({source_id: sourceId});

  if (source) {
    console.log('✅ Found source!');
    console.log(JSON.stringify(source, null, 2));
  } else {
    console.log('❌ Source not found');
  }

  await client.close();
})().catch(console.error);
