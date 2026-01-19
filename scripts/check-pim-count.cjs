#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: node scripts/check-pim-count.cjs <tenant-id>');
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;

  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: dbName,
  });

  const PIMProductSchema = new mongoose.Schema({}, { strict: false });
  const PIMProduct = mongoose.models.PIMProduct || mongoose.model('PIMProduct', PIMProductSchema, 'pimproducts');

  const total = await PIMProduct.countDocuments();
  const bySource = await PIMProduct.aggregate([
    { $group: { _id: '$source_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log(`\n=== PIM PRODUCTS - ${tenantId} ===\n`);
  console.log(`Database: ${dbName}`);
  console.log(`Total products: ${total}\n`);

  console.log('By source:');
  for (const source of bySource) {
    console.log(`  ${source._id || '(no source)'}: ${source.count}`);
  }

  // Show sample product
  const sample = await PIMProduct.findOne().lean();
  if (sample) {
    console.log(`\nSample product:`);
    console.log(`  Entity Code: ${sample.entity_code}`);
    console.log(`  SKU: ${sample.sku}`);
    console.log(`  Name: ${JSON.stringify(sample.name)}`);
    console.log(`  Status: ${sample.status}`);
    console.log(`  Is Parent: ${sample.is_parent}`);
    console.log(`  Parent: ${sample.parent_entity_code || 'N/A'}`);
    console.log(`  Source: ${sample.source_id || 'N/A'}`);
  }

  await mongoose.connection.close();
}

main().catch(console.error);
