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

  const source = await ImportSource.findOne({
    wholesaler_id: 'test-wholesaler-001',
    source_id: 'test-source-batch',
  }).exec();

  if (!source) {
    console.log('Source not found');
  } else {
    console.log('\n=== IMPORT SOURCE ===\n');
    console.log('Source ID:', source.source_id);
    console.log('Wholesaler ID:', source.wholesaler_id);
    console.log('Name:', source.name);
    console.log('Type:', source.type);
    console.log('Field Mapping (singular):', JSON.stringify(source.field_mapping, null, 2));
    console.log('Field Mappings (plural):', JSON.stringify(source.field_mappings, null, 2));
    console.log('Limits:', JSON.stringify(source.limits, null, 2));
    console.log('Auto Publish:', source.auto_publish_enabled);
  }

  await mongoose.connection.close();
}

main().catch(console.error);
