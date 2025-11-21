#!/usr/bin/env tsx
/**
 * Marketplace Sync Worker
 * Standalone worker process for syncing products to marketplaces
 *
 * Usage:
 *   pnpm worker:sync
 *   or
 *   tsx workers/sync-marketplace.ts
 */

// IMPORTANT: Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env as fallback (BEFORE other imports)
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Now import modules that depend on environment variables
import { connectToDatabase } from '../src/lib/db/connection';
import { syncWorker } from '../src/lib/queue/sync-worker';
import { AdapterFactory } from '../src/lib/adapters';

// Clear any cached adapter instances to ensure fresh initialization with current env vars
AdapterFactory.clearInstances();

console.log('🚀 Marketplace Sync Worker starting...');
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: ${process.env.SYNC_WORKER_CONCURRENCY || 2} jobs`);
console.log('');

// Show enabled marketplaces
console.log('📦 Enabled Marketplaces:');
if (process.env.SOLR_ENABLED === 'true') {
  console.log('   ✓ Solr 9 (Search Indexing)');
  console.log(`      URL: ${process.env.SOLR_URL || 'http://localhost:8983/solr'}`);
  console.log(`      Core: ${process.env.SOLR_CORE || 'mycore'}`);
}
if (process.env.EBAY_ENABLED === 'true') console.log('   ✓ eBay');
if (process.env.AMAZON_ENABLED === 'true') console.log('   ✓ Amazon SP-API');
if (process.env.TROVAPREZZI_ENABLED === 'true') console.log('   ✓ Trovaprezzi');
if (process.env.MANOMANO_ENABLED === 'true') console.log('   ✓ ManoMano');
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
