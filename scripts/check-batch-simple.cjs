#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const mongoose = require('mongoose');

const BATCH_ID = process.argv[2] || 'test-batch-1763128384037';

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  console.log(`\n🔍 Checking batch: ${BATCH_ID}\n`);

  const jobs = await mongoose.connection.db.collection('importjobs').find({
    batch_id: BATCH_ID
  }).toArray();

  console.log(`📊 Import Jobs: ${jobs.length} found`);
  jobs.forEach(job => {
    console.log(`  ✓ Job ${job.job_id}`);
    console.log(`    Part ${job.batch_part}/${job.batch_total_parts}`);
    console.log(`    Status: ${job.status}`);
    console.log(`    Success: ${job.successful_rows}/${job.total_rows}`);
  });

  const products = await mongoose.connection.db.collection('pimproducts').countDocuments({
    'source.batch_id': BATCH_ID
  });
  console.log(`\n📦 Products: ${products} found with batch_id\n`);

  await mongoose.connection.close();
}

main().catch(console.error);
