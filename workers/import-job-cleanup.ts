/**
 * Import Job Retention Worker
 * Prunes old ImportJob / AssociationJob documents per tenant.
 *
 * Usage:
 *   pnpm worker:import-job-cleanup
 *
 * Always preserves: pending/processing jobs, the latest N jobs per collection,
 * and any job newer than the retention window.
 */

import { importJobCleanupWorker } from "../src/lib/queue/import-job-cleanup-worker";
import { closeAllConnections } from "../src/lib/db/connection-pool";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Import Job Cleanup] Starting...");
console.log(`[Import Job Cleanup] Redis: ${redisHost}:${redisPort}`);
console.log("[Import Job Cleanup] Ready and listening for jobs");

process.on("SIGINT", async () => {
  console.log("[Import Job Cleanup] Shutting down...");
  await importJobCleanupWorker.close();
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Import Job Cleanup] Shutting down...");
  await importJobCleanupWorker.close();
  await closeAllConnections();
  process.exit(0);
});
