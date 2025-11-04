/**
 * Add API configuration to source and trigger test import
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.VINC_MONGO_URL;
const dbName = process.env.VINC_MONGO_DB || "hdr-api-it";

// You can change this to match your actual API endpoint
const TEST_API_CONFIG = {
  endpoint: "https://api.example.com/products",
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  auth_type: "none",
  schedule_cron: "0 */6 * * *" // Every 6 hours
};

async function setupApiSource() {
  console.log('🔌 Connecting to MongoDB...');
  console.log(`   Database: ${dbName}\n`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    const db = client.db(dbName);
    const sourcesCollection = db.collection('import_sources');

    // Find the API source
    const apiSource = await sourcesCollection.findOne({ source_type: 'api' });

    if (!apiSource) {
      console.log('❌ No API source found!');
      console.log('   Create one first via the UI or use scripts/create-api-import-source.cjs');
      return;
    }

    console.log('📦 Found API Source:');
    console.log('   ID:', apiSource.source_id);
    console.log('   Name:', apiSource.source_name);
    console.log('   Has API Config:', apiSource.api_config ? 'YES' : 'NO');
    console.log('');

    // Update with API configuration
    console.log('🔧 Adding API configuration...');
    const updateResult = await sourcesCollection.updateOne(
      { _id: apiSource._id },
      {
        $set: {
          api_config: TEST_API_CONFIG,
          updated_at: new Date()
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log('   ✅ API configuration added!\n');
    } else {
      console.log('   ℹ️  API configuration already exists\n');
    }

    // Show current state
    const updated = await sourcesCollection.findOne({ _id: apiSource._id });
    console.log('=' .repeat(60));
    console.log('📊 Source Configuration:');
    console.log('=' .repeat(60));
    console.log('Source ID:', updated.source_id);
    console.log('API Endpoint:', updated.api_config?.endpoint || 'NOT SET');
    console.log('Method:', updated.api_config?.method || 'NOT SET');
    console.log('Auth Type:', updated.api_config?.auth_type || 'none');
    console.log('Schedule:', updated.api_config?.schedule_cron || 'manual');
    console.log('Field Mappings:', Object.keys(updated.field_mappings || {}).length);
    console.log('Auto Publish:', updated.auto_publish_enabled ? 'ENABLED' : 'DISABLED');
    console.log('Total Products:', updated.stats?.total_products || 0);
    console.log('=' .repeat(60));

    console.log('\n📝 Next Steps:');
    console.log('   1. Update the API endpoint in this script to match your actual API');
    console.log('   2. Start the worker: pnpm worker:pim');
    console.log('   3. Trigger import via UI or API:');
    console.log(`      POST /api/b2b/pim/sources/${updated.source_id}/trigger-import`);
    console.log('   4. Monitor at: http://localhost:3000/api/admin/bull-board');
    console.log('');

    console.log('💡 To test with mock data:');
    console.log('   1. Update endpoint to use a test API like:');
    console.log('      https://jsonplaceholder.typicode.com/posts');
    console.log('   2. Configure field mappings to match the response');
    console.log('   3. Trigger the import\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

setupApiSource().catch(console.error);
