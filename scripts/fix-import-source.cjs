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
        type: 'file',  // Change from 'api' to 'file'
        field_mappings: {},  // Empty object for default field mappings
        updated_at: new Date(),
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
  console.log('  Type:', source.type);
  console.log('  Field Mappings:', JSON.stringify(source.field_mappings));

  await mongoose.connection.close();
}

main().catch(console.error);
