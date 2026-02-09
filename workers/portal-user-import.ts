#!/usr/bin/env vite-node
/**
 * Portal User Import Worker
 * Standalone worker process for handling bulk portal user imports
 *
 * Usage:
 *   pnpm worker:portal-user
 *   pnpm worker:portal-user --tenant hidros-it
 */

import { portalUserImportWorker } from '../src/lib/queue/portal-user-import-worker';

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

console.log('🚀 Portal User Import Worker starting...');
if (tenant) {
  console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})`);
} else {
  console.log('🎯 Multi-tenant mode: Jobs will use tenant-specific databases');
}
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: 2 jobs`);
console.log('');

async function startWorker() {
  try {
    console.log('✅ Worker ready and listening for jobs');
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
  await portalUserImportWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing worker...');
  await portalUserImportWorker.close();
  process.exit(0);
});

startWorker();
