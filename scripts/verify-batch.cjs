#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const mongoose = require('mongoose');

const BATCH_ID = process.argv[2] || 'test-batch-1763129006580';

async function main() {
  const mongoDb = process.env.VINC_TENANT_ID
    ? `vinc-${process.env.VINC_TENANT_ID}`
    : process.env.VINC_MONGO_DB;

  await mongoose.connect(process.env.VINC_MONGO_URL, { dbName: mongoDb });

  console.log(`\n========================================`);
  console.log(`📋 BATCH VERIFICATION: ${BATCH_ID}`);
  console.log(`========================================\n`);

  // Check import jobs
  const jobs = await mongoose.connection.db.collection('importjobs')
    .find({ batch_id: BATCH_ID })
    .sort({ batch_part: 1 })
    .toArray();

  console.log(`📊 Import Jobs: ${jobs.length} found\n`);
  jobs.forEach(job => {
    console.log(`  Part ${job.batch_part}/${job.batch_total_parts}:`);
    console.log(`    Job ID: ${job.job_id}`);
    console.log(`    Status: ${job.status}`);
    console.log(`    Success: ${job.successful_rows}/${job.total_rows}`);
    console.log(`    Duration: ${job.duration_seconds?.toFixed(2)}s`);
    console.log('');
  });

  // Check products
  const products = await mongoose.connection.db.collection('pimproducts')
    .find({ 'source.batch_id': BATCH_ID })
    .sort({ entity_code: 1 })
    .toArray();

  console.log(`📦 Products: ${products.length} found with batch_id\n`);
  console.log(`  Sample products:`);
  products.slice(0, 5).forEach(p => {
    console.log(`    ${p.entity_code}: ${p.name} (${p.status})`);
  });
  if (products.length > 5) {
    console.log(`    ... and ${products.length - 5} more`);
  }

  // Summary
  const totalSuccess = jobs.reduce((sum, j) => sum + (j.successful_rows || 0), 0);
  const totalFailed = jobs.reduce((sum, j) => sum + (j.failed_rows || 0), 0);
  const allCompleted = jobs.every(j => j.status === 'completed');

  console.log(`\n========================================`);
  console.log(`📈 BATCH SUMMARY`);
  console.log(`========================================`);
  console.log(`  Batch ID: ${BATCH_ID}`);
  console.log(`  Total Parts: ${jobs[0]?.batch_total_parts || 0}`);
  console.log(`  Completed Parts: ${jobs.filter(j => j.status === 'completed').length}`);
  console.log(`  Total Products: ${totalSuccess} successful, ${totalFailed} failed`);
  console.log(`  Status: ${allCompleted ? '✅ Complete' : '⚠️  In Progress'}`);
  console.log(`========================================\n`);

  await mongoose.connection.close();
}

main().catch(console.error);
