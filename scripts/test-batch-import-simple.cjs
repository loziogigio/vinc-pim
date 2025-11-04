#!/usr/bin/env node
/**
 * Simple Batch Import Test
 * Creates CSV files and tests batch import with errors
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Queue } = require('bullmq');
const mongoose = require('mongoose');

// Configuration
const TOTAL_ITEMS = parseInt(process.argv[2] || '1000');
const BATCH_SIZE = parseInt(process.argv[3] || '200');
const ERROR_RATE = 0.05; // 5% random errors
const WHOLESALER_ID = 'test-wholesaler-001';
const SOURCE_ID = 'test-source-batch';
const TEMP_DIR = path.join(__dirname, '../test-data/batch-import');

console.log(`
========================================
PIM BATCH IMPORT TEST (SIMPLE)
========================================
Total items: ${TOTAL_ITEMS.toLocaleString()}
Batch size: ${BATCH_SIZE}
Batches: ${Math.ceil(TOTAL_ITEMS / BATCH_SIZE)}
Error rate: ${(ERROR_RATE * 100)}%
Temp directory: ${TEMP_DIR}
========================================
`);

// Create temp directory
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Generate CSV content with random errors
function generateCSVBatch(startIndex, count, errorRate) {
  const headers = ['entity_code', 'sku', 'name', 'description', 'price', 'category', 'stock', 'weight', 'brand', 'status'];
  const rows = [headers.join(',')];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const shouldError = Math.random() < errorRate;

    let row;
    if (shouldError) {
      const errorType = Math.floor(Math.random() * 4);
      switch (errorType) {
        case 0:
          // Missing entity_code
          row = [
            '',  // Missing entity_code
            `SKU-${index}`,
            `Test Product ${index}`,
            `Description for ${index}`,
            (Math.random() * 100).toFixed(2),
            'Electronics',
            Math.floor(Math.random() * 1000),
            (Math.random() * 50).toFixed(2),
            'BrandA',
            'active'
          ];
          break;
        case 1:
          // Invalid price
          row = [
            `TEST-PROD-${String(index).padStart(5, '0')}`,
            `SKU-${index}`,
            `Test Product ${index}`,
            `Description for ${index}`,
            'invalid-price',  // Invalid price
            'Electronics',
            Math.floor(Math.random() * 1000),
            (Math.random() * 50).toFixed(2),
            'BrandB',
            'active'
          ];
          break;
        case 2:
          // Missing name
          row = [
            `TEST-PROD-${String(index).padStart(5, '0')}`,
            `SKU-${index}`,
            '',  // Missing name
            `Description for ${index}`,
            (Math.random() * 100).toFixed(2),
            'Home',
            Math.floor(Math.random() * 1000),
            (Math.random() * 50).toFixed(2),
            'BrandC',
            'active'
          ];
          break;
        case 3:
          // Invalid stock
          row = [
            `TEST-PROD-${String(index).padStart(5, '0')}`,
            `SKU-${index}`,
            `Test Product ${index}`,
            `Description for ${index}`,
            (Math.random() * 100).toFixed(2),
            'Sports',
            'invalid-stock',  // Invalid stock
            (Math.random() * 50).toFixed(2),
            'BrandA',
            'active'
          ];
          break;
      }
    } else {
      // Valid row
      const categories = ['Electronics', 'Clothing', 'Home', 'Sports'];
      const brands = ['BrandA', 'BrandB', 'BrandC'];
      row = [
        `TEST-PROD-${String(index).padStart(5, '0')}`,
        `SKU-${index}`,
        `Test Product ${index}`,
        `This is test product number ${index}`,
        (Math.random() * 100).toFixed(2),
        categories[Math.floor(Math.random() * categories.length)],
        Math.floor(Math.random() * 1000),
        (Math.random() * 50).toFixed(2),
        brands[Math.floor(Math.random() * brands.length)],
        'active'
      ];
    }

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

async function main() {
  try {
    //  Connect to MongoDB
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
    console.log('✓ Connected to MongoDB\n');

    // Check/create import source
    const ImportSource = mongoose.models.ImportSource || mongoose.model(
      'ImportSource',
      new mongoose.Schema({}, { strict: false })
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
        type: 'file',
        field_mappings: {},
        limits: {
          max_batch_size: 10000,
          warn_batch_size: 500,  // Lower threshold for testing
          chunk_size: 100,
          timeout_minutes: 60,
        },
        auto_publish_enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log('✓ Test source created\n');
    } else {
      console.log('✓ Using existing test source\n');
    }

    // Connect to Redis
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    console.log(`🔌 Connecting to Redis (${redisHost}:${redisPort})...`);
    const importQueue = new Queue('import-queue', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
    });
    console.log('✓ Connected to Redis\n');

    // Generate batch ID
    const batchId = `test-batch-${Date.now()}`;
    const numBatches = Math.ceil(TOTAL_ITEMS / BATCH_SIZE);

    console.log(`📦 Generating ${numBatches} CSV files...\n`);

    // Create CSV files and queue jobs
    for (let i = 0; i < numBatches; i++) {
      const batchPart = i + 1;
      const startIndex = i * BATCH_SIZE + 1;
      const count = Math.min(BATCH_SIZE, TOTAL_ITEMS - i * BATCH_SIZE);

      // Generate CSV content
      const csvContent = generateCSVBatch(startIndex, count, ERROR_RATE);

      // Write to file
      const filename = `batch-${batchPart}.csv`;
      const filepath = path.join(TEMP_DIR, filename);
      fs.writeFileSync(filepath, csvContent);

      console.log(`  ✓ Created ${filename} (${count} items, ${csvContent.length} bytes)`);
    }

    console.log(`\n✅ All CSV files created in: ${TEMP_DIR}`);
    console.log(`📋 Batch ID: ${batchId}`);
    console.log(`\nNOTE: Files created but not queued to worker.`);
    console.log(`You can manually import these files through the PIM UI or create an API endpoint.\n`);

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
