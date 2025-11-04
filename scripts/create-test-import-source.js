/**
 * Create test import source for PIM testing
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MONGO_URL = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';

async function createImportSource() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGO_DB);

    // Try to find admin or B2B user
    let adminUser = await db.collection('users').findOne({ role: 'admin' });

    if (!adminUser) {
      // Try B2B user
      adminUser = await db.collection('users').findOne({});
      if (!adminUser) {
        console.error('❌ No users found in database.');
        console.log('💡 Creating default admin user...');

        // Create a default admin user
        const newAdmin = {
          username: 'admin',
          email: 'admin@hidros.com',
          role: 'admin',
          created_at: new Date(),
          updated_at: new Date()
        };

        const userResult = await db.collection('users').insertOne(newAdmin);
        adminUser = { ...newAdmin, _id: userResult.insertedId };
        console.log('✅ Created default admin user');
      }
    }

    console.log(`📋 Using user: ${adminUser.username || adminUser.email || 'Unknown'}`);

    // Check if source already exists
    const existingSource = await db.collection('import_sources').findOne({
      source_id: 'test-csv-import'
    });

    if (existingSource) {
      console.log('ℹ️  Import source "test-csv-import" already exists');
      console.log('📦 Source details:', JSON.stringify(existingSource, null, 2));
      return;
    }

    // Create import source
    const importSource = {
      source_id: 'test-csv-import',
      source_name: 'Test CSV Import',
      source_type: 'manual_upload',
      wholesaler_id: adminUser._id.toString(),
      created_by: adminUser._id.toString(),
      auto_publish_enabled: true,
      auto_publish_threshold: 80,
      is_active: true,
      field_mappings: {
        entity_code: 'entity_code',
        sku: 'sku',
        name: 'name',
        description: 'description',
        price: 'price',
        sale_price: 'sale_price',
        quantity: 'quantity',
        currency: 'currency',
        unit: 'unit',
        brand_id: 'brand_id',
        brand_name: 'brand_name',
        category_id: 'category_id',
        category_name: 'category_name',
        image: 'image',
        gallery_image_1: 'gallery_image_1',
        gallery_image_2: 'gallery_image_2'
      },
      stats: {
        total_imports: 0,
        total_products: 0,
        avg_completeness_score: 0
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('import_sources').insertOne(importSource);

    console.log('✅ Import source created successfully!');
    console.log('📦 Source ID:', result.insertedId);
    console.log('\n🎯 You can now use this source to import the test CSV file');
    console.log('📁 CSV file location: test-data/pim-import-sample.csv');
    console.log('🌐 Import URL: http://localhost:3001/admin/pim/import');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createImportSource();
