/**
 * Cleanup stuck import jobs
 */

import { MongoClient } from 'mongodb';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MONGO_URL = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

async function cleanup() {
  const mongoClient = new MongoClient(MONGO_URL);

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
    console.log('✅ Connected to Redis');

    // Find stuck jobs in MongoDB
    const stuckJobs = await db.collection('import_jobs').find({
      status: { $in: ['pending', 'processing'] }
    }).toArray();

    console.log(`\n📋 Found ${stuckJobs.length} stuck jobs in MongoDB`);

    // Delete from MongoDB
    if (stuckJobs.length > 0) {
      const result = await db.collection('import_jobs').deleteMany({
        status: { $in: ['pending', 'processing'] }
      });
      console.log(`✅ Deleted ${result.deletedCount} jobs from MongoDB`);
    }

    // Clean up BullMQ
    console.log('\n🧹 Cleaning BullMQ queues...');

    // Get all job counts
    const counts = await importQueue.getJobCounts();
    console.log('📊 BullMQ job counts:', counts);

    // Clean failed and completed jobs
    await importQueue.clean(0, 1000, 'completed');
    await importQueue.clean(0, 1000, 'failed');

    // Obliterate (remove all jobs)
    await importQueue.obliterate({ force: true });

    console.log('✅ BullMQ queue cleaned');

    // Final status
    const finalCounts = await importQueue.getJobCounts();
    console.log('\n📊 Final BullMQ counts:', finalCounts);

    await importQueue.close();
    console.log('\n✨ Cleanup complete!');
    console.log('\nYou can now:');
    console.log('1. Restart the worker: pnpm worker:pim');
    console.log('2. Upload a fresh CSV file');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

cleanup();
