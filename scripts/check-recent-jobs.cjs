#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const mongoDb = process.env.VINC_TENANT_ID
    ? `vinc-${process.env.VINC_TENANT_ID}`
    : process.env.VINC_MONGO_DB;

  console.log(`Connecting to database: ${mongoDb}`);
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: mongoDb,
  });

  const ImportJob = mongoose.models.ImportJob || mongoose.model(
    'ImportJob',
    new mongoose.Schema({}, { strict: false })
  );

  const jobs = await ImportJob.find({})
    .sort({ created_at: -1 })
    .limit(10)
    .exec();

  console.log(`\nFound ${jobs.length} recent jobs:\n`);
  jobs.forEach(job => {
    console.log(`Job ID: ${job.job_id}`);
    console.log(`  Batch: ${job.batch_id || 'N/A'}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Rows: ${job.successful_rows || 0} success, ${job.failed_rows || 0} failed`);
    if (job.error_message) {
      console.log(`  Error: ${job.error_message}`);
    }
    console.log('');
  });

  await mongoose.connection.close();
}

main().catch(console.error);
