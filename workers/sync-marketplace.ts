#!/usr/bin/env vite-node
/**
 * Marketplace Sync Worker
 * Standalone worker process for syncing products to marketplaces
 *
 * Usage: pnpm worker:sync
 */

import { connectToDatabase } from '../src/lib/db/connection';
import { syncWorker } from '../src/lib/queue/sync-worker';
import { AdapterFactory, loadAdapterConfigs } from '../src/lib/adapters';

// Clear any cached adapter instances to ensure fresh initialization
AdapterFactory.clearInstances();

// Get adapter configs (single source of truth)
const adapterConfigs = loadAdapterConfigs();
const solrConfig = adapterConfigs.solr?.custom_config;

console.log('🚀 Marketplace Sync Worker starting...');
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: ${process.env.SYNC_WORKER_CONCURRENCY || 2} jobs`);
console.log('');

// Show enabled marketplaces
console.log('📦 Enabled Marketplaces:');
if (adapterConfigs.solr?.enabled) {
  console.log('   ✓ Solr 9 (Search Indexing)');
  console.log(`      URL: ${solrConfig?.solr_url}`);
  console.log(`      Core: ${solrConfig?.solr_core}`);
}
if (adapterConfigs.ebay?.enabled) console.log('   ✓ eBay');
if (adapterConfigs.amazon?.enabled) console.log('   ✓ Amazon SP-API');
if (adapterConfigs.trovaprezzi?.enabled) console.log('   ✓ Trovaprezzi');
if (adapterConfigs.manomano?.enabled) console.log('   ✓ ManoMano');
console.log('');

// Initialize database connection before worker starts
async function startWorker() {
  try {
    // Force fresh MongoDB connection
    await connectToDatabase();

    console.log('✅ Worker ready and listening for sync jobs');
    console.log('   Press Ctrl+C to stop');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing worker...');
  await syncWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing worker...');
  await syncWorker.close();
  process.exit(0);
});

// Start the worker
startWorker();
