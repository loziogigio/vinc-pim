require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const mongoose = require('mongoose');

const mongoUri = process.env.VINC_MONGO_URL;
const mongoDbName = process.env.VINC_MONGO_DB || "hdr-api-it";

async function checkJobErrors() {
  await mongoose.connect(mongoUri, { dbName: mongoDbName });

  const ImportJob = mongoose.connection.collection('importjobs');

  // Get the latest job
  const job = await ImportJob.findOne({}, { sort: { created_at: -1 } });

  if (!job) {
    console.log('❌ No jobs found');
    process.exit(1);
  }

  console.log('📋 Latest Job:', job.job_id);
  console.log('Status:', job.status);
  console.log('Total rows:', job.total_rows);
  console.log('Successful:', job.successful_rows);
  console.log('Failed:', job.failed_rows);
  console.log('');
  console.log('🔍 Full Job Document:');
  console.log(JSON.stringify(job, null, 2));

  process.exit(0);
}

checkJobErrors().catch(console.error);
