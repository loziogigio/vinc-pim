#!/usr/bin/env node
/**
 * Test Batch Import with Sample Data
 * Imports products directly via API with batch tracking
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const mongoose = require('mongoose');

// Configuration
const SOURCE_ID = 'test-10';
const TOTAL_ITEMS = 30;  // 30 products for testing
const BATCH_SIZE = 10;   // 10 products per batch (3 batches total)
const API_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// Sample product generator
function generateProduct(index) {
  const categories = ['Electronics', 'Clothing', 'Home', 'Sports'];
  const brands = ['BrandA', 'BrandB', 'BrandC'];
  const descriptions = [
    'High-quality product with excellent features and durability for everyday use',
    'Premium item crafted with attention to detail and superior materials',
    'Innovative design meets functionality in this exceptional product',
  ];

  return {
    entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
    sku: `SKU-${index}`,
    name: `Test Product ${index}`,
    description: descriptions[index % descriptions.length],
    image: {
      id: `placeholder-TEST-PROD-${String(index).padStart(5, '0')}`,
      thumbnail: '/images/placeholder-product.jpg',
      original: '/images/placeholder-product.jpg',
    },
    quantity: Math.floor(Math.random() * 1000),
    sold: 0,
    unit: 'pcs',
    brand: {
      name: brands[Math.floor(Math.random() * brands.length)],
      slug: brands[Math.floor(Math.random() * brands.length)].toLowerCase(),
    },
    category: {
      name: categories[Math.floor(Math.random() * categories.length)],
      slug: categories[Math.floor(Math.random() * categories.length)].toLowerCase(),
    },
    tags: ['test', 'sample'],
    product_type: {
      features: [],
    },
  };
}

async function main() {
  try {
    console.log(`
========================================
TEST BATCH IMPORT WITH SAMPLE DATA
========================================
API URL: ${API_URL}
Source: ${SOURCE_ID}
Total Items: ${TOTAL_ITEMS}
Batch Size: ${BATCH_SIZE}
========================================
`);

    // Connect to MongoDB to add batch_id after import
    const mongoUrl = process.env.VINC_MONGO_URL;
    // Use tenant-based database name like the API does
    const mongoDb = process.env.VINC_TENANT_ID
      ? `vinc-${process.env.VINC_TENANT_ID}`
      : process.env.VINC_MONGO_DB;

    if (!mongoUrl || !mongoDb) {
      throw new Error('MongoDB configuration not found in .env');
    }

    console.log(`🔌 Connecting to MongoDB (Database: ${mongoDb})...`);
    await mongoose.connect(mongoUrl, {
      dbName: mongoDb,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✓ Connected to MongoDB\n');

    // Generate batch ID with timestamp
    const batchId = `test-batch-${Date.now()}`;
    const numBatches = Math.ceil(TOTAL_ITEMS / BATCH_SIZE);

    console.log(`📦 Creating ${numBatches} batch imports`);
    console.log(`📋 Batch ID: ${batchId}\n`);

    const ImportJob = mongoose.models.ImportJob || mongoose.model(
      'ImportJob',
      new mongoose.Schema({}, { strict: false })
    );

    const PIMProduct = mongoose.models.PIMProduct || mongoose.model(
      'PIMProduct',
      new mongoose.Schema({}, { strict: false })
    );

    const results = [];

    // Import each batch
    for (let i = 0; i < numBatches; i++) {
      const batchPart = i + 1;
      const startIndex = i * BATCH_SIZE + 1;
      const count = Math.min(BATCH_SIZE, TOTAL_ITEMS - i * BATCH_SIZE);

      // Generate products for this batch
      const products = [];
      for (let j = 0; j < count; j++) {
        products.push(generateProduct(startIndex + j));
      }

      console.log(`\n📦 Importing Part ${batchPart}/${numBatches}...`);
      console.log(`   Products: ${products[0].entity_code} - ${products[products.length - 1].entity_code}`);

      // Import via API
      const response = await fetch(`${API_URL}/api/b2b/pim/import/api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_id: SOURCE_ID,
          products: products,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`   ❌ Import failed: ${result.error || 'Unknown error'}`);
        continue;
      }

      console.log(`   ✅ Imported: ${result.summary.successful}/${result.summary.total} products`);
      console.log(`   📋 Job ID: ${result.job_id}`);

      // Update the import job with batch metadata
      await ImportJob.findOneAndUpdate(
        { job_id: result.job_id },
        {
          $set: {
            batch_id: batchId,
            batch_part: batchPart,
            batch_total_parts: numBatches,
            batch_total_items: TOTAL_ITEMS,
          },
        }
      );

      // Update the imported products with batch_id in source
      const entityCodes = products.map(p => p.entity_code);
      await PIMProduct.updateMany(
        {
          entity_code: { $in: entityCodes },
          'source.source_id': SOURCE_ID,
        },
        {
          $set: {
            'source.batch_id': batchId,
          },
        }
      );

      console.log(`   ✅ Added batch metadata to job and products`);

      results.push({
        batchPart,
        jobId: result.job_id,
        successful: result.summary.successful,
        failed: result.summary.failed,
      });

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n========================================`);
    console.log(`✅ ALL BATCHES IMPORTED SUCCESSFULLY!`);
    console.log(`========================================`);
    console.log(`📋 Batch ID: ${batchId}`);
    console.log(`📊 Summary:`);
    results.forEach(r => {
      console.log(`   Part ${r.batchPart}: ${r.successful} successful, ${r.failed} failed (Job: ${r.jobId})`);
    });

    console.log(`\n📊 To check batch in database:`);
    console.log(`   db.importjobs.find({ batch_id: "${batchId}" })`);
    console.log(`   db.pimproducts.find({ "source.batch_id": "${batchId}" }).count()`);
    console.log(`\n🔍 To view batch progress:`);
    console.log(`   node scripts/check-batch-progress.cjs ${batchId}`);
    console.log(`\n`);

    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
