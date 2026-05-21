/**
 * PIM Version Retention Worker
 * Prunes old PIMProduct version documents per tenant.
 *
 * Usage:
 *   pnpm worker:pim-version-cleanup
 *
 * Always preserves: current version, currently-published version,
 * last N versions, and any version newer than the retention window.
 */

import { pimVersionCleanupWorker } from "../src/lib/queue/pim-version-cleanup-worker";
import { closeAllConnections } from "../src/lib/db/connection-pool";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[PIM Version Cleanup] Starting...");
console.log(`[PIM Version Cleanup] Redis: ${redisHost}:${redisPort}`);
console.log("[PIM Version Cleanup] Ready and listening for jobs");

process.on("SIGINT", async () => {
  console.log("[PIM Version Cleanup] Shutting down...");
  await pimVersionCleanupWorker.close();
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[PIM Version Cleanup] Shutting down...");
  await pimVersionCleanupWorker.close();
  await closeAllConnections();
  process.exit(0);
});
