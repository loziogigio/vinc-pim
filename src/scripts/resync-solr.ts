/**
 * Re-sync all products from MongoDB to Solr
 * Updates Solr index with latest product data including attribute facet fields
 *
 * Usage: pnpm solr:resync
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { PIMProductModel } from '../lib/db/models/pim-product';
import { SolrAdapter, loadAdapterConfigs } from '../lib/adapters';
import { connectToDatabase, disconnectAll } from '../lib/db/connection';

const BATCH_SIZE = 100;

async function main() {
  console.log('🔄 Solr Re-sync Tool\n');

  // Connect to MongoDB using centralized connection (single source of truth)
  await connectToDatabase();
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`✓ Connected to MongoDB: ${dbName}\n`);

  // Initialize Solr adapter (config from loadAdapterConfigs - single source of truth)
  const adapterConfigs = loadAdapterConfigs();
  const solrConfig = adapterConfigs.solr;

  if (!solrConfig?.enabled) {
    console.error('❌ Solr adapter is not enabled. Set SOLR_ENABLED=true');
    process.exit(1);
  }

  const solrUrl = solrConfig.custom_config?.solr_url;
  const solrCore = solrConfig.custom_config?.solr_core;
  console.log(`  Solr URL: ${solrUrl}`);
  console.log(`  Solr Core: ${solrCore}`);

  const solrAdapter = new SolrAdapter(solrConfig);

  // Ensure Solr collection exists (creates if missing)
  try {
    const { exists, created } = await solrAdapter.ensureCollection();
    if (created) {
      console.log(`✓ Created Solr collection: ${solrCore}`);
    } else if (exists) {
      console.log('✓ Solr collection exists\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to Solr:', error.message);
    console.error('   Make sure Solr is running and accessible');
    process.exit(1);
  }

  // Count total products
  const totalCount = await PIMProductModel.countDocuments({ isCurrent: true });
  console.log(`📊 Found ${totalCount} current products to sync\n`);

  if (totalCount === 0) {
    console.log('No products to sync.');
    await disconnectAll();
    return;
  }

  // Process in batches
  let processed = 0;
  let success = 0;
  let errors = 0;
  const startTime = Date.now();

  console.log(`Processing in batches of ${BATCH_SIZE}...\n`);

  // Use cursor for memory efficiency
  const cursor = PIMProductModel.find({ isCurrent: true })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  let batch: any[] = [];

  for await (const product of cursor) {
    batch.push(product);

    if (batch.length >= BATCH_SIZE) {
      const result = await processBatch(solrAdapter, batch, processed, totalCount);
      success += result.success;
      errors += result.errors;
      processed += batch.length;
      batch = [];
    }
  }

  // Process remaining
  if (batch.length > 0) {
    const result = await processBatch(solrAdapter, batch, processed, totalCount);
    success += result.success;
    errors += result.errors;
    processed += batch.length;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Re-sync complete!`);
  console.log(`   Total: ${processed}`);
  console.log(`   Success: ${success}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Rate: ${(processed / parseFloat(duration)).toFixed(1)} products/sec`);

  await disconnectAll();
}

async function processBatch(
  adapter: SolrAdapter,
  products: any[],
  processed: number,
  total: number
): Promise<{ success: number; errors: number }> {
  try {
    // Use bulkIndexProducts which handles transform + index + commit
    const result = await adapter.bulkIndexProducts(products);

    const pct = (((processed + products.length) / total) * 100).toFixed(1);
    process.stdout.write(`\r  Progress: ${processed + products.length}/${total} (${pct}%) - Success: ${result.success}, Failed: ${result.failed}`);

    return { success: result.success, errors: result.failed };
  } catch (error: any) {
    console.error(`\n  ❌ Batch error:`, error.message);
    return { success: 0, errors: products.length };
  }
}

// Run
main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
