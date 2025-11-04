#!/usr/bin/env node
/**
 * Update Import Source Chunk Size to 500
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: process.env.VINC_MONGO_DB,
  });

  const ImportSource = mongoose.models.ImportSource || mongoose.model(
    'ImportSource',
    new mongoose.Schema({}, { strict: false })
  );

  // Update the test source
  const result = await ImportSource.updateOne(
    {
      wholesaler_id: '6900ac2364787f6f09231006',
      source_id: 'api-produc-fl',
    },
    {
      $set: {
        'limits.chunk_size': 500,
        'limits.warn_batch_size': 500,
        updated_at: new Date(),
      },
    }
  );

  console.log('\n✅ Updated import source chunk size to 500');
  console.log('   Matched:', result.matchedCount);
  console.log('   Modified:', result.modifiedCount);

  // Verify the update
  const source = await ImportSource.findOne({
    wholesaler_id: '6900ac2364787f6f09231006',
    source_id: 'api-produc-fl',
  }).exec();

  console.log('\nUpdated limits:');
  console.log('  chunk_size:', source.limits?.chunk_size || 'default (100)');
  console.log('  warn_batch_size:', source.limits?.warn_batch_size || 'default (5000)');
  console.log('  max_batch_size:', source.limits?.max_batch_size || 'default (10000)');
  console.log('');

  await mongoose.connection.close();
}

main().catch(console.error);
