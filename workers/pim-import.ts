#!/usr/bin/env vite-node
/**
 * PIM Import Worker
 * Standalone worker process for handling product imports
 *
 * Usage:
 *   pnpm worker:pim
 *   pnpm worker:pim --tenant hidros-it
 *   pnpm worker:pim --tenant dfl-eventi-it
 */

import { connectToDatabase } from '../src/lib/db/connection';
import { importWorker } from '../src/lib/queue/import-worker';
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

console.log('🚀 PIM Import Worker starting...');
if (tenant) {
  console.log(`🎯 Target tenant: ${tenant} (database: ${tenantDb})`);
} else {
  console.log('🎯 Multi-tenant mode: Jobs will use tenant-specific databases');
}
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: 2 jobs`);
console.log('');

// Initialize worker (no database connection at startup - connects per-job)
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
  await importWorker.close();
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing worker...');
  await importWorker.close();
  await closeAllConnections();
  process.exit(0);
});

// Start the worker
startWorker();
