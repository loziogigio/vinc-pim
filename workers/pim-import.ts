#!/usr/bin/env tsx
/**
 * PIM Import Worker
 * Standalone worker process for handling product imports
 *
 * Usage:
 *   pnpm worker:pim
 *   or
 *   tsx workers/pim-import.ts
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { connectToDatabase } from '../src/lib/db/connection';
import { importWorker } from '../src/lib/queue/import-worker';

// Load .env.local first, then .env as fallback
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log('🚀 PIM Import Worker starting...');
console.log(`📍 Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`📊 Concurrency: 2 jobs`);
console.log('');

// Initialize database connection before worker starts
async function startWorker() {
  try {
    // Force fresh MongoDB connection
    await connectToDatabase();

    console.log('✅ Worker ready and listening for jobs');
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
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing worker...');
  await importWorker.close();
  process.exit(0);
});

// Start the worker
startWorker();
