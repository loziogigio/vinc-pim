import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://root:root@localhost:27017/?authSource=admin');

async function check() {
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db('app');

    const homeTemplates = db.collection('home_templates');
    const template = await homeTemplates.findOne({ templateId: 'home-page' });

    if (template) {
      console.log('Found home-page template');
      console.log('Blocks in version 1:');
      template.versions[0].blocks.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.type} - ID: ${b.id}`);
      });
    } else {
      console.log('No home-page template found');
    }

  } finally {
    await client.close();
  }
}

check();
