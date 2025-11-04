/**
 * Simple Script: Create Product with Active Conflicts
 * This creates conflicts WITHOUT resolving them so you can test the UI
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.VINC_MONGO_URL || 'mongodb://admin:admin@localhost:27017/?authSource=admin';
const MONGODB_NAME = process.env.VINC_MONGO_DB || 'app';

const PIMProductSchema = new mongoose.Schema({}, { strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
const ImportSourceSchema = new mongoose.Schema({}, { strict: false });

const PIMProduct = mongoose.models.PIMProduct || mongoose.model('PIMProduct', PIMProductSchema);
const ImportSource = mongoose.models.ImportSource || mongoose.model('ImportSource', ImportSourceSchema);

const TEST_WHOLESALER_ID = '6900ac2364787f6f09231006';
const TEST_ENTITY_CODE = 'TEST-CONFLICT-001';
const TEST_SOURCE_NAME = 'test-conflict-source';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_NAME });
    console.log('✅ Connected to MongoDB\n');

    // Find or create import source
    let source = await ImportSource.findOne({
      wholesaler_id: TEST_WHOLESALER_ID,
      name: TEST_SOURCE_NAME
    });

    if (!source) {
      source = await ImportSource.create({
        wholesaler_id: TEST_WHOLESALER_ID,
        name: TEST_SOURCE_NAME,
        type: 'api',
        status: 'active',
        overwrite_level: 'manual', // IMPORTANT: Manual mode
        config: { url: 'https://api.example.com/products', method: 'GET', headers: {} },
        field_mappings: [],
        last_import_at: new Date(),
        total_imported: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ Created import source with MANUAL mode');
    } else {
      console.log('✅ Using existing import source');
    }

    // Get current product
    const currentProduct = await PIMProduct.findOne({
      wholesaler_id: TEST_WHOLESALER_ID,
      entity_code: TEST_ENTITY_CODE,
      isCurrent: true
    });

    if (!currentProduct) {
      console.log('❌ Product not found. Run test-conflict-resolution.cjs first.');
      process.exit(1);
    }

    // Mark current as not current
    await PIMProduct.updateOne(
      { _id: currentProduct._id },
      { $set: { isCurrent: false } }
    );

    // Create new version WITH CONFLICTS
    const newVersion = currentProduct.version + 1;
    const now = new Date();

    await PIMProduct.create({
      wholesaler_id: TEST_WHOLESALER_ID,
      entity_code: TEST_ENTITY_CODE,
      version: newVersion,
      isCurrent: true,
      isCurrentPublished: false,
      status: 'draft',

      // Keep manual values
      sku: currentProduct.sku,
      name: currentProduct.name,
      description: currentProduct.description,
      quantity: currentProduct.quantity,
      unit: currentProduct.unit,
      image: currentProduct.image,

      source: currentProduct.source,

      // Manual edit tracking
      manually_edited: true,
      edited_by: currentProduct.edited_by || 'test-user@example.com',
      edited_at: currentProduct.edited_at || now,
      manually_edited_fields: currentProduct.manually_edited_fields || ['name', 'description', 'quantity'],
      last_manual_update_at: currentProduct.last_manual_update_at || now,
      last_api_update_at: now,

      // CREATE CONFLICTS!
      has_conflict: true,
      conflict_data: [
        {
          field: 'name',
          manual_value: currentProduct.name,
          api_value: 'Test Product - NEW API VERSION [CONFLICT]',
          detected_at: now
        },
        {
          field: 'description',
          manual_value: currentProduct.description,
          api_value: 'This is the NEW API description that conflicts!',
          detected_at: now
        },
        {
          field: 'quantity',
          manual_value: currentProduct.quantity,
          api_value: 999,
          detected_at: now
        }
      ],

      completeness_score: currentProduct.completeness_score || 80,
      critical_issues: [],
      auto_publish_enabled: false,
      auto_publish_eligible: false,
      min_score_threshold: 80,
      required_fields: [],
      analytics: {
        views_30d: 0,
        clicks_30d: 0,
        add_to_cart_30d: 0,
        conversions_30d: 0,
        priority_score: 0
      },
      locked_fields: [],
      created_at: now,
      updated_at: now
    });

    console.log('🎉 SUCCESS! Created version', newVersion, 'with 3 ACTIVE CONFLICTS!\n');
    console.log('📍 URLs to test:');
    console.log('   Product Page: http://localhost:3001/b2b/pim/products/TEST-CONFLICT-001');
    console.log('   History Page: http://localhost:3001/b2b/pim/products/TEST-CONFLICT-001/history');
    console.log('\n⚠️  You should now see:');
    console.log('   - Orange conflict warning banner on product page');
    console.log('   - 3 conflicts to resolve (name, description, quantity)');
    console.log('   - Side-by-side comparison with "Choose" buttons\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();
