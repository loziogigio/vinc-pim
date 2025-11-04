#!/usr/bin/env node
/**
 * Check Batch Progress Script
 *
 * Check the progress of a batch import
 * Usage: node scripts/check-batch-progress.cjs <batch_id>
 */

require('dotenv').config();
const mongoose = require('mongoose');

const BATCH_ID = process.argv[2];

if (!BATCH_ID) {
  console.error('Usage: node scripts/check-batch-progress.cjs <batch_id>');
  process.exit(1);
}

async function main() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.VINC_MONGO_URL;
    const mongoDb = process.env.VINC_MONGO_DB;

    if (!mongoUrl || !mongoDb) {
      throw new Error('MongoDB configuration not found in .env');
    }

    await mongoose.connect(mongoUrl, {
      dbName: mongoDb,
      serverSelectionTimeoutMS: 5000,
    });

    // Import the batch tracking utilities
    const ImportJobModel = mongoose.models.ImportJob || mongoose.model(
      'ImportJob',
      new mongoose.Schema({
        wholesaler_id: String,
        source_id: String,
        job_id: String,
        status: String,
        total_rows: Number,
        processed_rows: Number,
        successful_rows: Number,
        failed_rows: Number,
        auto_published_count: Number,
        batch_id: String,
        batch_part: Number,
        batch_total_parts: Number,
        batch_total_items: Number,
        started_at: Date,
        completed_at: Date,
        duration_seconds: Number,
        import_errors: Array,
        created_at: Date,
        updated_at: Date,
      })
    );

    console.log(`\n🔍 Checking progress for batch: ${BATCH_ID}\n`);

    const jobs = await ImportJobModel.find({ batch_id: BATCH_ID })
      .sort({ batch_part: 1 })
      .exec();

    if (jobs.length === 0) {
      console.log('❌ No jobs found for this batch ID\n');
      await mongoose.connection.close();
      return;
    }

    const expectedParts = jobs[0]?.batch_total_parts || 0;
    const totalItems = jobs[0]?.batch_total_items || 0;

    // Calculate progress
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const processing = jobs.filter(j => j.status === 'processing').length;
    const pending = jobs.filter(j => j.status === 'pending').length;

    const totalSuccessful = jobs.reduce((sum, j) => sum + (j.successful_rows || 0), 0);
    const totalFailed = jobs.reduce((sum, j) => sum + (j.failed_rows || 0), 0);
    const totalProcessed = jobs.reduce((sum, j) => sum + (j.processed_rows || 0), 0);
    const autoPublished = jobs.reduce((sum, j) => sum + (j.auto_published_count || 0), 0);

    const progressPercent = expectedParts > 0
      ? Math.round((completed / expectedParts) * 100)
      : 0;

    // Overall status
    let overallStatus = '🟡 IN PROGRESS';
    if (completed === expectedParts) {
      overallStatus = failed > 0 ? '🟠 PARTIAL SUCCESS' : '🟢 COMPLETE';
    } else if (failed === expectedParts) {
      overallStatus = '🔴 FAILED';
    }

    console.log('========================================');
    console.log('BATCH PROGRESS');
    console.log('========================================');
    console.log(`Status: ${overallStatus}`);
    console.log(`Progress: ${completed}/${expectedParts} parts (${progressPercent}%)`);
    console.log(`Total Items: ${totalItems.toLocaleString()}`);
    console.log('');
    console.log('Part Status:');
    console.log(`  ✓ Completed: ${completed}`);
    console.log(`  ⏳ Processing: ${processing}`);
    console.log(`  ⏸️  Pending: ${pending}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log('');
    console.log('Items:');
    console.log(`  ✓ Successful: ${totalSuccessful.toLocaleString()} (${((totalSuccessful/totalItems)*100).toFixed(1)}%)`);
    console.log(`  ✗ Failed: ${totalFailed.toLocaleString()} (${((totalFailed/totalItems)*100).toFixed(1)}%)`);
    console.log(`  📊 Processed: ${totalProcessed.toLocaleString()}/${totalItems.toLocaleString()}`);
    if (autoPublished > 0) {
      console.log(`  🚀 Auto-published: ${autoPublished.toLocaleString()}`);
    }
    console.log('');

    // Check for missing parts
    const receivedParts = new Set(jobs.map(j => j.batch_part));
    const missingParts = [];
    for (let i = 1; i <= expectedParts; i++) {
      if (!receivedParts.has(i)) {
        missingParts.push(i);
      }
    }

    if (missingParts.length > 0) {
      console.log(`⚠️  Missing parts: ${missingParts.join(', ')}\n`);
    }

    // Show detailed part status
    console.log('========================================');
    console.log('DETAILED PART STATUS');
    console.log('========================================\n');

    for (const job of jobs) {
      const statusIcon = {
        completed: '✓',
        processing: '⏳',
        pending: '⏸️',
        failed: '✗',
      }[job.status] || '?';

      const successRate = job.total_rows > 0
        ? ((job.successful_rows / job.total_rows) * 100).toFixed(1)
        : 0;

      console.log(`${statusIcon} Part ${job.batch_part}/${expectedParts}: ${job.status.toUpperCase()}`);
      console.log(`   Job ID: ${job.job_id}`);
      console.log(`   Items: ${job.successful_rows || 0}/${job.total_rows || 0} (${successRate}% success)`);

      if (job.failed_rows > 0) {
        console.log(`   ⚠️  Failed: ${job.failed_rows} items`);
      }

      if (job.duration_seconds) {
        console.log(`   ⏱️  Duration: ${job.duration_seconds}s`);
      }

      if (job.import_errors && job.import_errors.length > 0) {
        console.log(`   ❌ Errors: ${job.import_errors.length} (showing first 3):`);
        job.import_errors.slice(0, 3).forEach((err, idx) => {
          console.log(`      ${idx + 1}. Row ${err.row}: ${err.error}`);
        });
      }

      console.log('');
    }

    console.log('========================================\n');

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
