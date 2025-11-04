#!/usr/bin/env node
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

  const result = await ImportSource.updateOne(
    {
      wholesaler_id: 'test-wholesaler-001',
      source_id: 'test-source-batch',
    },
    {
      $set: {
        source_type: 'csv',  // Change to csv
        field_mapping: [],  // Empty array for default 1:1 field mapping
        updated_at: new Date(),
      },
      $unset: {
        field_mappings: '',  // Remove old plural field
      },
    }
  );

  console.log('✓ Updated import source');
  console.log('  Matched:', result.matchedCount);
  console.log('  Modified:', result.modifiedCount);

  // Verify the update
  const source = await ImportSource.findOne({
    wholesaler_id: 'test-wholesaler-001',
    source_id: 'test-source-batch',
  }).exec();

  console.log('\nUpdated source:');
  console.log('  Source Type:', source.source_type);
  console.log('  Field Mapping:', JSON.stringify(source.field_mapping));
  console.log('  Field Mapping is Array:', Array.isArray(source.field_mapping));

  await mongoose.connection.close();
}

main().catch(console.error);
