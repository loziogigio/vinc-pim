/**
 * Cleanup stuck import jobs - Tenant-aware version
 *
 * Usage:
 *   node scripts/cleanup-stuck-jobs.js <tenant-id>
 *   node scripts/cleanup-stuck-jobs.js dfl-eventi-it
 *   node scripts/cleanup-stuck-jobs.js hidros-it
 */

import { MongoClient } from 'mongodb';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Error: Tenant ID is required');
  console.error('');
  console.error('Usage: node scripts/cleanup-stuck-jobs.js <tenant-id>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/cleanup-stuck-jobs.js dfl-eventi-it');
  console.error('  node scripts/cleanup-stuck-jobs.js hidros-it');
  process.exit(1);
}

// Required environment variables (no fallbacks)
const MONGO_URL = process.env.VINC_MONGO_URL;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '');

if (!MONGO_URL) {
  console.error('❌ Error: VINC_MONGO_URL environment variable is required');
  process.exit(1);
}

if (!REDIS_HOST || !REDIS_PORT) {
  console.error('❌ Error: REDIS_HOST and REDIS_PORT environment variables are required');
  process.exit(1);
}

// Build tenant database name
const MONGO_DB = `vinc-${tenantId}`;

async function cleanup() {
  const mongoClient = new MongoClient(MONGO_URL);

  console.log('\n🧹 CLEANUP STUCK JOBS');
  console.log('='.repeat(60));
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database: ${MONGO_DB}`);
  console.log(`Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  console.log('='.repeat(60) + '\n');

  try {
    // Connect to MongoDB
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    const db = mongoClient.db(MONGO_DB);

    // Connect to Redis queue
    const importQueue = new Queue('import-queue', {
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });
    console.log('✅ Connected to Redis\n');

    // Find stuck jobs in MongoDB
    console.log('🔍 Checking for stuck jobs in MongoDB...');
    const stuckJobs = await db.collection('importjobs').find({
      status: { $in: ['pending', 'processing'] }
    }).toArray();

    console.log(`📋 Found ${stuckJobs.length} stuck jobs`);

    if (stuckJobs.length > 0) {
      console.log('\nStuck jobs:');
      for (const job of stuckJobs) {
        console.log(`  - ${job.job_id} | Status: ${job.status} | Source: ${job.source_id}`);
      }

      // Delete from MongoDB
      const result = await db.collection('importjobs').deleteMany({
        status: { $in: ['pending', 'processing'] }
      });
      console.log(`\n✅ Deleted ${result.deletedCount} stuck jobs from MongoDB`);
    } else {
      console.log('✅ No stuck jobs found in MongoDB');
    }

    // Clean up BullMQ
    console.log('\n🧹 Cleaning BullMQ queues...');

    // Get all job counts
    const counts = await importQueue.getJobCounts();
    console.log('📊 Current BullMQ job counts:', counts);

    // Clean failed and completed jobs
    await importQueue.clean(0, 1000, 'completed');
    await importQueue.clean(0, 1000, 'failed');

    // Obliterate (remove all jobs)
    await importQueue.obliterate({ force: true });

    console.log('✅ BullMQ queue cleaned');

    // Final status
    const finalCounts = await importQueue.getJobCounts();
    console.log('📊 Final BullMQ counts:', finalCounts);

    await importQueue.close();

    console.log('\n' + '='.repeat(60));
    console.log('✨ CLEANUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`Tenant: ${tenantId}`);
    console.log(`MongoDB stuck jobs removed: ${stuckJobs.length}`);
    console.log(`BullMQ queue cleaned`);
    console.log('='.repeat(60) + '\n');

    console.log('You can now:');
    console.log(`1. Restart the worker: pnpm worker:pim --tenant ${tenantId}`);
    console.log('2. Upload a fresh CSV file or trigger new imports');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

cleanup();
