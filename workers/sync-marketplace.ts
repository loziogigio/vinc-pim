#!/usr/bin/env vite-node
/**
 * Marketplace Sync Worker
 * Standalone worker process for syncing products to marketplaces
 *
 * Usage:
 *   pnpm worker:sync
 *   pnpm worker:sync --tenant hidros-it
 *   pnpm worker:sync --tenant dfl-eventi-it
 */

import { connectToDatabase } from '../src/lib/db/connection';
import { syncWorker } from '../src/lib/queue/sync-worker';
import { AdapterFactory, loadAdapterConfigs } from '../src/lib/adapters';
import { closeAllConnections } from "../src/lib/db/connection-pool";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf('--tenant');

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

const { tenant } = parseArgs();
const tenantDb = tenant ? `vinc-${tenant}` : undefined;

// Clear any cached adapter instances to ensure fresh initialization
AdapterFactory.clearInstances();

// Get adapter configs (single source of truth)
// Pass tenant to get tenant-specific config, or undefined for multi-tenant mode
const adapterConfigs = loadAdapterConfigs(tenant);
const solrConfig = adapterConfigs.solr?.custom_config;

console.log('�� Marketplace Sync Worker starting...');
if (tenant) {
  console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})`);
} else {
  console.log('🎯 Multi-tenant mode: Jobs will use tenant-specific cores');
}
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: ${process.env.SYNC_WORKER_CONCURRENCY || 2} jobs`);
console.log('');

// Show enabled marketplaces
console.log('📦 Enabled Marketplaces:');
if (adapterConfigs.solr?.enabled) {
  console.log('   ✓ Solr 9 (Search Indexing)');
  console.log(`      URL: ${solrConfig?.solr_url}`);
  if (tenant) {
    console.log(`      Core: ${solrConfig?.solr_core}`);
  } else {
    console.log(`      Core: vinc-{tenant-id} (dynamic per job)`);
  }
}
if (adapterConfigs.ebay?.enabled) console.log('   ✓ eBay');
if (adapterConfigs.amazon?.enabled) console.log('   ✓ Amazon SP-API');
if (adapterConfigs.trovaprezzi?.enabled) console.log('   ✓ Trovaprezzi');
if (adapterConfigs.manomano?.enabled) console.log('   ✓ ManoMano');
console.log('');

// Initialize worker (no database connection at startup - connects per-job)
async function startWorker() {
  try {
    console.log('✅ Worker ready and listening for sync jobs');
    console.log('   Jobs will connect to tenant-specific databases');
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
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing worker...');
  await syncWorker.close();
  await closeAllConnections();
  process.exit(0);
});

// Start the worker
startWorker();
