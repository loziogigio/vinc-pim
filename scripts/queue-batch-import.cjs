#!/usr/bin/env node
/**
 * Queue Batch Import Jobs
 * Queues import jobs for CSV files served by the local test server
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const fs = require('fs');
const path = require('path');

// Configuration
const WHOLESALER_ID = 'test-wholesaler-001';
const SOURCE_ID = 'test-source-batch';
const FILE_SERVER_URL = 'http://localhost:8888';
const BATCH_DIR = path.join(__dirname, '../test-data/batch-import');

async function main() {
  try {
    // Connect to Redis
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    console.log(`
========================================
QUEUE BATCH IMPORT JOBS
========================================
Redis: ${redisHost}:${redisPort}
Source: ${SOURCE_ID}
Wholesaler: ${WHOLESALER_ID}
File Server: ${FILE_SERVER_URL}
========================================
`);

    console.log('🔌 Connecting to Redis...');
    const importQueue = new Queue('import-queue', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
    });
    console.log('✓ Connected to Redis\n');

    // Get CSV files
    const files = fs.readdirSync(BATCH_DIR)
      .filter(f => f.endsWith('.csv'))
      .sort();

    if (files.length === 0) {
      throw new Error(`No CSV files found in ${BATCH_DIR}`);
    }

    // Generate batch ID
    const batchId = `test-batch-${Date.now()}`;
    const totalParts = files.length;

    // Count total items across all files
    let totalItems = 0;
    files.forEach(file => {
      const content = fs.readFileSync(path.join(BATCH_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      totalItems += lines.length - 1; // Subtract header row
    });

    console.log(`📦 Found ${totalParts} CSV files (${totalItems} total items)`);
    console.log(`📋 Batch ID: ${batchId}\n`);

    // Queue jobs
    console.log('⏳ Queueing import jobs...\n');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const batchPart = i + 1;
      const fileUrl = `${FILE_SERVER_URL}/${file}`;

      // Count items in this file
      const content = fs.readFileSync(path.join(BATCH_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const itemCount = lines.length - 1;

      const jobData = {
        job_id: `${batchId}-part-${batchPart}`,
        wholesaler_id: WHOLESALER_ID,
        source_id: SOURCE_ID,
        file_name: file,
        file_url: fileUrl,
        batch_metadata: {
          batch_id: batchId,
          batch_part: batchPart,
          batch_total_parts: totalParts,
          batch_total_items: totalItems,
        },
      };

      const job = await importQueue.add('import', jobData, {
        jobId: jobData.job_id,
        removeOnComplete: false,
        removeOnFail: false,
      });

      console.log(`  ✓ Queued Part ${batchPart}/${totalParts}: ${file} (${itemCount} items)`);
      console.log(`    Job ID: ${job.id}`);
      console.log(`    File URL: ${fileUrl}`);
    }

    console.log(`\n✅ All ${totalParts} jobs queued successfully!`);
    console.log(`\n📊 To monitor progress, run:`);
    console.log(`   node scripts/check-batch-progress.cjs ${batchId}\n`);

    await importQueue.close();
    console.log('✓ Queue connection closed\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
