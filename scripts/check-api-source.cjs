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
    source_id: 'api-produc-fl',
  }).exec();

  if (!source) {
    console.log('Source not found');
  } else {
    console.log('\n=== API IMPORT SOURCE ===\n');
    console.log('Source ID:', source.source_id);
    console.log('Wholesaler ID:', source.wholesaler_id);
    console.log('Name:', source.source_name);
    console.log('Type:', source.source_type);
    console.log('\nAPI Config:', JSON.stringify(source.api_config, null, 2));
    console.log('\nField Mapping:', JSON.stringify(source.field_mapping, null, 2));
    console.log('\nLimits:', JSON.stringify(source.limits, null, 2));
    console.log('\nStats:', JSON.stringify(source.stats, null, 2));
  }

  await mongoose.connection.close();
}

main().catch(console.error);
