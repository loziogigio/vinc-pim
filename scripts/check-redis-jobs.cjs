#!/usr/bin/env node
require('dotenv').config();
const { Queue } = require('bullmq');

async function main() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  const queue = new Queue('import-queue', {
    connection: { host: redisHost, port: redisPort },
  });

  console.log('\n=== IMPORT QUEUE STATUS ===\n');

  const counts = await queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  console.log('Job counts:');
  console.log(`  Waiting: ${counts.wait}`);
  console.log(`  Active: ${counts.active}`);
  console.log(`  Completed: ${counts.completed}`);
  console.log(`  Failed: ${counts.failed}`);
  console.log(`  Delayed: ${counts.delayed}`);

  console.log('\n=== RECENT JOBS ===\n');

  const completed = await queue.getJobs(['completed'], 0, 5);
  const failed = await queue.getJobs(['failed'], 0, 5);
  const active = await queue.getJobs(['active']);

  if (active.length > 0) {
    console.log('Active jobs:');
    for (const job of active) {
      console.log(`  ${job.id} - Progress: ${job.progress}`);
    }
    console.log('');
  }

  if (completed.length > 0) {
    console.log('Recently completed jobs:');
    for (const job of completed) {
      console.log(`  ${job.id}`);
      if (job.returnvalue) {
        console.log(`    Result: ${JSON.stringify(job.returnvalue).substring(0, 100)}`);
      }
    }
    console.log('');
  }

  if (failed.length > 0) {
    console.log('Recently failed jobs:');
    for (const job of failed) {
      console.log(`  ${job.id}`);
      if (job.failedReason) {
        console.log(`    Reason: ${job.failedReason.substring(0, 200)}`);
      }
    }
    console.log('');
  }

  await queue.close();
}

main().catch(console.error);
