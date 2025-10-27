import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://root:root@localhost:27017/?authSource=admin';
const DB_NAME = 'hdr-api-it';

async function testVersionStatus() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection('b2bhometemplates');

    // Find version 2
    const version2 = await collection.findOne({
      templateId: 'home-page',
      version: 2
    });

    console.log('\n========== VERSION 2 DETAILS ==========');
    console.log('Document found:', !!version2);

    if (version2) {
      console.log('\nFull document:');
      console.log(JSON.stringify(version2, null, 2));

      console.log('\n========== KEY FIELDS ==========');
      console.log('version:', version2.version);
      console.log('status:', version2.status);
      console.log('status type:', typeof version2.status);
      console.log('status === "published":', version2.status === "published");
      console.log('status !== "published":', version2.status !== "published");
      console.log('isCurrent:', version2.isCurrent);
      console.log('isCurrentPublished:', version2.isCurrentPublished);
      console.log('blocks count:', version2.blocks?.length);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testVersionStatus();
