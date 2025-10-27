import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://root:root@localhost:27017/?authSource=admin';
const DB_NAME = 'hdr-api-it';
const TEMPLATE_ID = 'home-page';

async function checkAndFixDatabase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Check both collections
    console.log('\n========== CHECKING b2bhometemplates ==========');
    const oldCollection = db.collection('b2bhometemplates');
    const oldDocs = await oldCollection.find({ templateId: TEMPLATE_ID }).toArray();
    console.log(`Found ${oldDocs.length} documents in b2bhometemplates`);
    oldDocs.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  templateId: ${doc.templateId}`);
      console.log(`  version: ${doc.version}`);
      console.log(`  status: ${doc.status}`);
      console.log(`  isCurrent: ${doc.isCurrent}`);
      console.log(`  isCurrentPublished: ${doc.isCurrentPublished}`);
      console.log(`  blocks: ${doc.blocks?.length || 0}`);
      console.log(`  versions array: ${doc.versions ? doc.versions.length : 'N/A (new structure)'}`);
    });

    console.log('\n========== CHECKING b2bhometemplates_new ==========');
    const newCollection = db.collection('b2bhometemplates_new');
    const newDocs = await newCollection.find({ templateId: TEMPLATE_ID }).toArray();
    console.log(`Found ${newDocs.length} documents in b2bhometemplates_new`);
    newDocs.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  version: ${doc.version}`);
      console.log(`  status: ${doc.status}`);
      console.log(`  isCurrent: ${doc.isCurrent}`);
      console.log(`  isCurrentPublished: ${doc.isCurrentPublished}`);
      console.log(`  blocks: ${doc.blocks?.length || 0}`);
    });

    // Check indexes on old collection
    console.log('\n========== INDEXES on b2bhometemplates ==========');
    const oldIndexes = await oldCollection.indexes();
    oldIndexes.forEach(index => {
      console.log(`${index.name}: ${JSON.stringify(index.key)}`);
      if (index.unique) {
        console.log(`  ⚠️  UNIQUE INDEX`);
      }
    });

    // Offer to fix
    console.log('\n========== RECOMMENDED ACTIONS ==========');

    if (oldDocs.length > 0 && oldDocs[0].versions) {
      console.log('⚠️  Old collection has documents in OLD FORMAT (with versions array)');
      console.log('   Action: Need to migrate this data OR use new collection');
    }

    if (oldDocs.length > 0 && !oldDocs[0].versions) {
      console.log('⚠️  Old collection has documents in NEW FORMAT but missing flags');
      console.log('   Action: Need to set isCurrent and isCurrentPublished flags');
    }

    if (newDocs.length > 0) {
      console.log('✅ New collection has migrated data');
      console.log('   Action: Rename b2bhometemplates_new to b2bhometemplates');
    }

    // Check for unique index issue
    const uniqueTemplateIdIndex = oldIndexes.find(
      idx => idx.key.templateId === 1 && idx.unique && Object.keys(idx.key).length === 1
    );
    if (uniqueTemplateIdIndex) {
      console.log('\n⚠️  CRITICAL: Old collection has unique index on templateId alone');
      console.log('   This prevents multiple version documents!');
      console.log(`   Index name: ${uniqueTemplateIdIndex.name}`);
      console.log('   Action: Drop this index before using new structure');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAndFixDatabase();
