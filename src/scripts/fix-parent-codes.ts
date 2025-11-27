/**
 * Fix Parent Entity Codes
 * Updates products where parent_entity_code is null/empty
 * Sets parent_entity_code = entity_code and parent_sku = sku
 *
 * Usage: pnpm fix:parent-codes
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { PIMProductModel } from '../lib/db/models/pim-product';
import { connectToDatabase, disconnectAll } from '../lib/db/connection';

async function main() {
  console.log('🔧 Fix Parent Entity Codes\n');

  // Connect to MongoDB
  await connectToDatabase();
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`✓ Connected to MongoDB: ${dbName}\n`);

  // Count products that need fixing
  const countToFix = await PIMProductModel.countDocuments({
    isCurrent: true,
    $or: [
      { parent_entity_code: { $exists: false } },
      { parent_entity_code: null },
      { parent_entity_code: '' },
    ],
  });

  console.log(`📊 Found ${countToFix} products with missing parent_entity_code\n`);

  if (countToFix === 0) {
    console.log('✅ No products need fixing.');
    await disconnectAll();
    return;
  }

  // Perform bulk update using aggregation pipeline
  console.log('Updating products...\n');
  const startTime = Date.now();

  const result = await PIMProductModel.updateMany(
    {
      isCurrent: true,
      $or: [
        { parent_entity_code: { $exists: false } },
        { parent_entity_code: null },
        { parent_entity_code: '' },
      ],
    },
    [
      {
        $set: {
          parent_entity_code: '$entity_code',
          parent_sku: '$sku',
        },
      },
    ]
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Update complete!`);
  console.log(`   Matched: ${result.matchedCount}`);
  console.log(`   Modified: ${result.modifiedCount}`);
  console.log(`   Duration: ${duration}s\n`);

  // Verify the fix
  const remainingCount = await PIMProductModel.countDocuments({
    isCurrent: true,
    $or: [
      { parent_entity_code: { $exists: false } },
      { parent_entity_code: null },
      { parent_entity_code: '' },
    ],
  });

  if (remainingCount === 0) {
    console.log('✓ Verification passed: All products now have parent_entity_code\n');
  } else {
    console.log(`⚠️  ${remainingCount} products still missing parent_entity_code\n`);
  }

  // Show sample of updated products
  const samples = await PIMProductModel.find({ isCurrent: true })
    .select('entity_code sku parent_entity_code parent_sku')
    .limit(5)
    .lean();

  console.log('Sample products after update:');
  samples.forEach((p: any) => {
    console.log(`  ${p.sku}: parent_entity_code=${p.parent_entity_code}, parent_sku=${p.parent_sku}`);
  });

  await disconnectAll();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
