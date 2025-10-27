import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://root:root@localhost:27017/?authSource=admin';
const DB_NAME = 'hdr-api-it';

async function finalizeMigration() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Step 1: Verify new collection exists and has data
    console.log('\n========== STEP 1: Verify new collection ==========');
    const newCollection = db.collection('b2bhometemplates_new');
    const newCount = await newCollection.countDocuments({ templateId: 'home-page' });

    if (newCount === 0) {
      console.log('❌ ERROR: b2bhometemplates_new has no documents!');
      console.log('   Cannot proceed with migration.');
      return;
    }

    console.log(`✅ Found ${newCount} documents in b2bhometemplates_new`);

    // Step 2: Backup old collection
    console.log('\n========== STEP 2: Backup old collection ==========');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `b2bhometemplates_backup_${timestamp}`;

    try {
      await db.collection('b2bhometemplates').rename(backupName);
      console.log(`✅ Renamed b2bhometemplates to ${backupName}`);
    } catch (error) {
      if (error.code === 26) { // NamespaceNotFound
        console.log('⚠️  Old collection does not exist (already migrated?)');
      } else {
        throw error;
      }
    }

    // Step 3: Promote new collection
    console.log('\n========== STEP 3: Promote new collection ==========');
    try {
      await db.collection('b2bhometemplates_new').rename('b2bhometemplates');
      console.log('✅ Renamed b2bhometemplates_new to b2bhometemplates');
    } catch (error) {
      console.error('❌ ERROR renaming new collection:', error.message);

      // Try to rollback
      console.log('\n⚠️  Attempting rollback...');
      try {
        await db.collection(backupName).rename('b2bhometemplates');
        console.log('✅ Rollback successful - old collection restored');
      } catch (rollbackError) {
        console.error('❌ ROLLBACK FAILED:', rollbackError.message);
        console.error('⚠️  MANUAL INTERVENTION REQUIRED!');
      }
      throw error;
    }

    // Step 4: Verify final state
    console.log('\n========== STEP 4: Verify final state ==========');
    const finalCollection = db.collection('b2bhometemplates');
    const finalCount = await finalCollection.countDocuments({ templateId: 'home-page' });
    const docs = await finalCollection.find({ templateId: 'home-page' }).toArray();

    console.log(`✅ Final b2bhometemplates collection has ${finalCount} documents`);
    docs.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      console.log(`  version: ${doc.version}`);
      console.log(`  status: ${doc.status}`);
      console.log(`  isCurrent: ${doc.isCurrent}`);
      console.log(`  isCurrentPublished: ${doc.isCurrentPublished}`);
      console.log(`  blocks: ${doc.blocks?.length || 0}`);
    });

    console.log('\n========== MIGRATION FINALIZED SUCCESSFULLY! ==========');
    console.log('✅ Old collection backed up as:', backupName);
    console.log('✅ New collection promoted to b2bhometemplates');
    console.log('');
    console.log('⚠️  NEXT STEPS:');
    console.log('1. Restart vinc-storefront application');
    console.log('2. Restart customer_web application');
    console.log('3. Test the page builder and home page');
    console.log('');
    console.log('If everything works, you can delete the backup collection later:');
    console.log(`   db.${backupName}.drop()`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await client.close();
  }
}

finalizeMigration();
