#!/usr/bin/env node
/**
 * Test Batch Import Script
 *
 * Tests the import system with batch tracking, monitoring, and error handling
 * Usage: node scripts/test-batch-import.cjs [total_items] [batch_size]
 * Example: node scripts/test-batch-import.cjs 1000 200
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const mongoose = require('mongoose');

// Configuration
const TOTAL_ITEMS = parseInt(process.argv[2] || '1000');
const BATCH_SIZE = parseInt(process.argv[3] || '200');
const ERROR_RATE = 0.05; // 5% random errors
const WHOLESALER_ID = 'test-wholesaler-001';
const SOURCE_ID = 'test-source-batch';

console.log(`
========================================
PIM BATCH IMPORT TEST
========================================
Total items: ${TOTAL_ITEMS.toLocaleString()}
Batch size: ${BATCH_SIZE}
Batches: ${Math.ceil(TOTAL_ITEMS / BATCH_SIZE)}
Error rate: ${(ERROR_RATE * 100)}%
========================================
`);

// Generate random product data
function generateProduct(index, shouldError = false) {
  const baseProduct = {
    entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
    sku: `SKU-${index}`,
    name: `Test Product ${index}`,
    description: `This is test product number ${index} for batch import testing`,
    price: Math.floor(Math.random() * 10000) / 100,
    category: ['Electronics', 'Clothing', 'Home', 'Sports'][Math.floor(Math.random() * 4)],
    stock: Math.floor(Math.random() * 1000),
    weight: Math.floor(Math.random() * 5000) / 100,
    brand: ['BrandA', 'BrandB', 'BrandC'][Math.floor(Math.random() * 3)],
    status: 'active',
  };

  // Introduce random errors
  if (shouldError) {
    const errorType = Math.floor(Math.random() * 4);
    switch (errorType) {
      case 0:
        // Missing required field (entity_code)
        delete baseProduct.entity_code;
        break;
      case 1:
        // Invalid price (negative)
        baseProduct.price = -Math.random() * 100;
        break;
      case 2:
        // Invalid data type
        baseProduct.stock = 'invalid-number';
        break;
      case 3:
        // Missing name
        delete baseProduct.name;
        break;
    }
  }

  return baseProduct;
}

// Generate all products
function generateProducts(total, errorRate) {
  const products = [];
  for (let i = 1; i <= total; i++) {
    const shouldError = Math.random() < errorRate;
    products.push(generateProduct(i, shouldError));
  }
  return products;
}

// Split into batches
function splitIntoBatches(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

async function main() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.VINC_MONGO_URL;
    const mongoDb = process.env.VINC_MONGO_DB;

    if (!mongoUrl || !mongoDb) {
      throw new Error('MongoDB configuration not found in .env');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      dbName: mongoDb,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✓ Connected to MongoDB');

    // Check if import source exists, create if not
    const ImportSource = mongoose.models.ImportSource || mongoose.model(
      'ImportSource',
      new mongoose.Schema({
        wholesaler_id: String,
        source_id: String,
        name: String,
        type: String,
        field_mappings: mongoose.Schema.Types.Mixed,
        limits: {
          max_batch_size: Number,
          warn_batch_size: Number,
          chunk_size: Number,
          timeout_minutes: Number,
        },
        auto_publish_enabled: Boolean,
        created_at: Date,
        updated_at: Date,
      })
    );

    let source = await ImportSource.findOne({
      wholesaler_id: WHOLESALER_ID,
      source_id: SOURCE_ID,
    });

    if (!source) {
      console.log('📝 Creating test import source...');
      source = await ImportSource.create({
        wholesaler_id: WHOLESALER_ID,
        source_id: SOURCE_ID,
        name: 'Test Batch Import Source',
        type: 'api',
        field_mappings: {},
        limits: {
          max_batch_size: 10000,
          warn_batch_size: 5000,
          chunk_size: 100,
          timeout_minutes: 60,
        },
        auto_publish_enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log('✓ Test source created');
    } else {
      console.log('✓ Using existing test source');
    }

    // Connect to Redis and create queue
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    console.log(`🔌 Connecting to Redis (${redisHost}:${redisPort})...`);
    const importQueue = new Queue('import-queue', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
    });

    console.log('✓ Connected to Redis');

    // Generate products
    console.log(`\n📦 Generating ${TOTAL_ITEMS.toLocaleString()} products...`);
    const allProducts = generateProducts(TOTAL_ITEMS, ERROR_RATE);
    console.log(`✓ Generated ${allProducts.length} products`);

    // Split into batches
    const batches = splitIntoBatches(allProducts, BATCH_SIZE);
    const batchId = `test-batch-${Date.now()}`;

    console.log(`\n🔀 Split into ${batches.length} batches of ~${BATCH_SIZE} items`);
    console.log(`📋 Batch ID: ${batchId}\n`);

    // Queue each batch
    console.log('📤 Queueing batches to import worker...\n');

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPart = i + 1;

      // Use API import format - create a mock API endpoint that returns our data
      // For this test, we'll use a data URL as a workaround
      const jobData = {
        job_id: `test-job-${batchPart}-${Date.now()}`,
        wholesaler_id: WHOLESALER_ID,
        source_id: SOURCE_ID,
        file_name: `test-batch-${batchPart}.csv`,
        file_url: `data:text/plain,${encodeURIComponent(
          batch.map(p => Object.values(p).join(',')).join('\n')
        )}`,
        batch_metadata: {
          batch_id: batchId,
          batch_part: batchPart,
          batch_total_parts: batches.length,
          batch_total_items: TOTAL_ITEMS,
        },
      };

      const job = await importQueue.add(`import-batch-${batchPart}`, jobData, {
        attempts: 1,
        backoff: { type: 'exponential', delay: 2000 },
      });

      console.log(`  ✓ Batch ${batchPart}/${batches.length}: Job ${job.id} queued (${batch.length} items)`);
    }

    console.log(`\n✅ All ${batches.length} batches queued successfully!\n`);
    console.log('📊 Monitor progress:');
    console.log('   - Check worker logs for metrics and alerts');
    console.log('   - View jobs in PIM dashboard: http://localhost:3000/b2b/pim/jobs');
    console.log(`   - Batch ID: ${batchId}\n`);

    console.log('🔍 To check batch progress:');
    console.log(`   node scripts/check-batch-progress.cjs ${batchId}\n`);

    // Cleanup
    await importQueue.close();
    await mongoose.connection.close();

    console.log('✓ Connections closed\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
