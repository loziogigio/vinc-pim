/**
 * Delete ALL import jobs (fresh start)
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MONGO_URL = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';

async function deleteAllJobs() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(MONGO_DB);

    // List all jobs first
    const allJobs = await db.collection('import_jobs').find({}).toArray();
    console.log(`\n📋 Found ${allJobs.length} jobs in database:`);

    allJobs.forEach((job, i) => {
      console.log(`   ${i + 1}. ${job.file_name || 'Unknown'} - Status: ${job.status} - Job ID: ${job.job_id}`);
    });

    // Delete ALL jobs
    if (allJobs.length > 0) {
      const result = await db.collection('import_jobs').deleteMany({});
      console.log(`\n✅ Deleted ${result.deletedCount} jobs from MongoDB`);
    } else {
      console.log('\n✨ No jobs to delete');
    }

    console.log('\n✨ Database cleaned!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

deleteAllJobs();
