#!/usr/bin/env node
/**
 * Check Failed Jobs in Redis
 */

require('dotenv').config();
const { Queue } = require('bullmq');

async function main() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  const importQueue = new Queue('import-queue', {
    connection: {
      host: redisHost,
      port: redisPort,
    },
  });

  console.log('\n🔍 Checking failed jobs...\n');

  const failed = await importQueue.getFailed(0, 20);

  console.log(`Total failed jobs (last 20): ${failed.length}\n`);

  for (const job of failed) {
    console.log(`Job ID: ${job.id}`);
    console.log(`  Failed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`);
    console.log(`  Error: ${job.failedReason}`);
    console.log(`  Batch: ${job.data.batch_metadata?.batch_id || 'N/A'}`);
    console.log();
  }

  await importQueue.close();
}

main().catch(console.error);
