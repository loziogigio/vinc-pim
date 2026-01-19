#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: node scripts/check-recent-imports.cjs <tenant-id>');
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;

  await mongoose.connect(process.env.VINC_MONGO_URL, {
    dbName: dbName,
  });

  const PIMProductSchema = new mongoose.Schema({}, { strict: false });
  const PIMProduct = mongoose.models.PIMProduct || mongoose.model('PIMProduct', PIMProductSchema, 'pimproducts');

  // Get total count
  const total = await PIMProduct.countDocuments();

  // Get recently updated products (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await PIMProduct.find({
    updated_at: { $gte: fiveMinutesAgo }
  }).limit(10).lean();

  console.log(`\n=== RECENT IMPORTS - ${tenantId} ===\n`);
  console.log(`Database: ${dbName}`);
  console.log(`Total products: ${total}`);
  console.log(`Recently updated (last 5 min): ${recent.length}\n`);

  if (recent.length > 0) {
    console.log('Recent products:');
    for (const product of recent) {
      console.log(`  ${product.entity_code} | ${product.sku} | ${product.name?.it || 'No name'} | Parent: ${product.is_parent} | Source: ${product.source_id || 'N/A'}`);
    }

    // Show one complete product
    console.log(`\n=== Sample Recent Product ===`);
    const sample = recent[0];
    console.log(JSON.stringify(sample, null, 2));
  } else {
    console.log('No products updated in last 5 minutes');

    // Show latest 5 products
    const latest = await PIMProduct.find().sort({ updated_at: -1 }).limit(5).lean();
    console.log('\nLatest 5 products:');
    for (const product of latest) {
      console.log(`  ${product.entity_code} | ${product.sku} | Updated: ${product.updated_at}`);
    }
  }

  await mongoose.connection.close();
}

main().catch(console.error);
