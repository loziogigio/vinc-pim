#!/usr/bin/env node
/**
 * Queue API Batch Import Jobs
 * Tests batch tracking with API imports
 */

require('dotenv').config();
const { Queue } = require('bullmq');

// Configuration
const WHOLESALER_ID = '6900ac2364787f6f09231006'; // From existing source
const SOURCE_ID = 'api-produc-fl';
const TOTAL_ITEMS = 1000;  // Start with 1k for auto-publish testing
const BATCH_SIZE = 500;
const API_ENDPOINT = 'http://localhost:3000/products-with-errors';

async function main() {
  try {
    // Connect to Redis
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    console.log(`
========================================
QUEUE API BATCH IMPORT JOBS
========================================
Redis: ${redisHost}:${redisPort}
Source: ${SOURCE_ID}
Wholesaler: ${WHOLESALER_ID}
API Endpoint: ${API_ENDPOINT}
Total Items: ${TOTAL_ITEMS}
Batch Size: ${BATCH_SIZE}
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

    // Generate batch ID
    const batchId = `api-batch-${Date.now()}`;
    const numBatches = Math.ceil(TOTAL_ITEMS / BATCH_SIZE);

    console.log(`📦 Creating ${numBatches} batch jobs`);
    console.log(`📋 Batch ID: ${batchId}\n`);

    // Queue jobs
    console.log('⏳ Queueing API import jobs...\n');

    for (let i = 0; i < numBatches; i++) {
      const batchPart = i + 1;
      const offset = i * BATCH_SIZE;
      const limit = Math.min(BATCH_SIZE, TOTAL_ITEMS - offset);

      const jobData = {
        job_id: `${batchId}-part-${batchPart}`,
        wholesaler_id: WHOLESALER_ID,
        source_id: SOURCE_ID,

        // API configuration
        api_config: {
          endpoint: `${API_ENDPOINT}?page=${batchPart}&pageSize=${BATCH_SIZE}`,
          method: 'GET',
          auth_type: 'none',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        },

        // Batch metadata
        batch_metadata: {
          batch_id: batchId,
          batch_part: batchPart,
          batch_total_parts: numBatches,
          batch_total_items: TOTAL_ITEMS,
        },
      };

      const job = await importQueue.add('import', jobData, {
        jobId: jobData.job_id,
        removeOnComplete: false,
        removeOnFail: false,
      });

      console.log(`  ✓ Queued Part ${batchPart}/${numBatches}: page=${batchPart}, pageSize=${BATCH_SIZE}`);
      console.log(`    Job ID: ${job.id}`);
      console.log(`    API URL: ${jobData.api_config.endpoint}`);
    }

    console.log(`\n✅ All ${numBatches} jobs queued successfully!`);
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
