#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.VINC_MONGO_URL);

  try {
    await client.connect();
    const db = client.db(process.env.VINC_MONGO_DB);
    const collection = db.collection('importsources');

    const source = await collection.findOne({
      wholesaler_id: 'test-wholesaler-001',
      source_id: 'test-source-batch',
    });

    console.log('\n=== RAW MONGODB DOCUMENT ===\n');
    console.log(JSON.stringify(source, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
