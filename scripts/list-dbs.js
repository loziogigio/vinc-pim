import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://root:root@localhost:27017/?authSource=admin');

async function list() {
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();

    console.log('Available databases:\n');
    for (const dbInfo of dbs.databases) {
      console.log(`- ${dbInfo.name}`);

      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();

      for (const coll of collections) {
        const collObj = db.collection(coll.name);
        const count = await collObj.countDocuments();
        console.log(`  └─ ${coll.name} (${count} documents)`);
      }
      console.log('');
    }

  } finally {
    await client.close();
  }
}

list();
