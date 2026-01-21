/**
 * Re-sync all products from MongoDB to Solr
 * Updates Solr index with latest product data including attribute facet fields
 *
 * Usage: pnpm solr:resync
 */

import 'dotenv/config';
import { SolrAdapter, loadAdapterConfigs } from '../lib/adapters';
import { connectWithModels, disconnectAll } from '../lib/db/connection';
import { syncSolrSchemaWithLanguages } from '../services/solr-schema.service';

const BATCH_SIZE = 100;

async function main() {
  console.log('🔄 Solr Re-sync Tool\n');

  // Get tenant ID from environment
  const tenantId = process.env.VINC_TENANT_ID;
  if (!tenantId) {
    console.error('❌ VINC_TENANT_ID environment variable is required');
    console.error('   Usage: VINC_TENANT_ID=hidros-it pnpm run solr:resync');
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;

  // Connect to MongoDB using centralized connection (single source of truth)
  const { PIMProduct, Language } = await connectWithModels(dbName);
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
      console.log('✓ Solr collection exists');
    }

    // Ensure schema is properly set up (creates fields with correct types)
    console.log('\n📋 Ensuring Solr schema is up to date...');
    const enabledLanguages = await Language.find({ isEnabled: true }).sort({ order: 1 });
    if (enabledLanguages.length > 0) {
      await syncSolrSchemaWithLanguages(enabledLanguages);
    } else {
      console.log('  ⚠️  No enabled languages found - run seed-languages first');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to Solr:', error.message);
    console.error('   Make sure Solr is running and accessible');
    process.exit(1);
  }

  // Count total products
  const totalCount = await PIMProduct.countDocuments({ isCurrent: true });
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
  const cursor = PIMProduct.find({ isCurrent: true })
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
