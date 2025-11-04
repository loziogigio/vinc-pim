import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://root:root@localhost:27017/?authSource=admin');

async function list() {
  try {
    await client.connect();
    const db = client.db('app');

    const homeTemplates = db.collection('home_templates');
    const templates = await homeTemplates.find({}).toArray();

    console.log(`Found ${templates.length} template(s):\n`);
    templates.forEach((t, i) => {
      console.log(`${i + 1}. templateId: "${t.templateId}"`);
      console.log(`   name: "${t.name}"`);
      console.log(`   _id: ${t._id}`);
      console.log(`   versions: ${t.versions?.length || 0}`);
      console.log('');
    });

  } finally {
    await client.close();
  }
}

list();
