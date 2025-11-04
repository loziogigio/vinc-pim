#!/usr/bin/env node
/**
 * Check Auto-Publish Results
 * Verify products were auto-published based on completeness scores
 */

require('dotenv').config();
const mongoose = require('mongoose');

const WHOLESALER_ID = '6900ac2364787f6f09231006';
const BATCH_ID = 'api-batch-1762163034397';

async function main() {
  try {
    await mongoose.connect(process.env.VINC_MONGO_URL, {
      dbName: process.env.VINC_MONGO_DB,
    });

    console.log('\n🔍 Checking Auto-Publish Results...\n');

    const PIMProduct = mongoose.model('PIMProduct', new mongoose.Schema({}, { strict: false }), 'pim_products');
    const ImportJob = mongoose.model('ImportJob', new mongoose.Schema({}, { strict: false }), 'import_jobs');

    // Get import jobs for this batch
    const jobs = await ImportJob.find({ batch_id: BATCH_ID }).sort({ batch_part: 1 });

    console.log('📦 Batch Import Summary:');
    console.log('========================\n');

    let totalProcessed = 0;
    let totalAutoPublished = 0;

    for (const job of jobs) {
      console.log(`Part ${job.batch_part}/${job.batch_total_parts}:`);
      console.log(`  Processed: ${job.processed_count || 0}`);
      console.log(`  Successful: ${job.successful_count || 0}`);
      console.log(`  Auto-Published: ${job.auto_published_count || 'N/A'}`);

      totalProcessed += job.successful_count || 0;
      totalAutoPublished += job.auto_published_count || 0;
    }

    console.log(`\n📊 Total: ${totalProcessed} processed, ${totalAutoPublished} auto-published\n`);

    // Check products by status
    const publishedCount = await PIMProduct.countDocuments({
      wholesaler_id: WHOLESALER_ID,
      status: 'published'
    });

    const draftCount = await PIMProduct.countDocuments({
      wholesaler_id: WHOLESALER_ID,
      status: 'draft'
    });

    console.log('📈 Product Status Distribution:');
    console.log('================================\n');
    console.log(`  Published: ${publishedCount}`);
    console.log(`  Draft: ${draftCount}`);
    console.log(`  Total: ${publishedCount + draftCount}\n`);

    // Sample some products by quality level
    console.log('🎯 Sample Products by Quality:');
    console.log('===============================\n');

    const highQual = await PIMProduct.find({
      wholesaler_id: WHOLESALER_ID,
      entity_code: /^HIGH-QUAL/
    }).limit(3).select('entity_code sku name status completeness_score auto_publish_eligible');

    const medQual = await PIMProduct.find({
      wholesaler_id: WHOLESALER_ID,
      entity_code: /^MED-QUAL/
    }).limit(3).select('entity_code sku name status completeness_score auto_publish_eligible');

    const lowQual = await PIMProduct.find({
      wholesaler_id: WHOLESALER_ID,
      entity_code: /^LOW-QUAL/
    }).limit(3).select('entity_code sku name status completeness_score auto_publish_eligible');

    console.log('High Quality Products:');
    highQual.forEach(p => {
      console.log(`  ${p.entity_code} - Status: ${p.status}, Score: ${p.completeness_score || 'N/A'}, Auto-Publish: ${p.auto_publish_eligible || false}`);
    });

    console.log('\nMedium Quality Products:');
    medQual.forEach(p => {
      console.log(`  ${p.entity_code} - Status: ${p.status}, Score: ${p.completeness_score || 'N/A'}, Auto-Publish: ${p.auto_publish_eligible || false}`);
    });

    console.log('\nLow Quality Products:');
    lowQual.forEach(p => {
      console.log(`  ${p.entity_code} - Status: ${p.status}, Score: ${p.completeness_score || 'N/A'}, Auto-Publish: ${p.auto_publish_eligible || false}`);
    });

    console.log('\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
