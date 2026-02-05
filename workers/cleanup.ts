/**
 * FCM Token Cleanup Worker
 * Processes scheduled cleanup jobs for FCM tokens
 *
 * Usage:
 *   pnpm worker:cleanup
 *
 * This worker handles:
 * - Removal of inactive/stale FCM tokens
 * - Cleanup of anonymous tokens (no user)
 * - Removal of duplicate tokens per device
 * - Deletion of permanently failed tokens
 */

import { cleanupWorker } from "../src/lib/queue/cleanup-worker";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Cleanup Worker] Starting...");
console.log(`[Cleanup Worker] Redis: ${redisHost}:${redisPort}`);

// Worker is already created and listening via the import
console.log("[Cleanup Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[Cleanup Worker] Shutting down...");
  await cleanupWorker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Cleanup Worker] Shutting down...");
  await cleanupWorker.close();
  process.exit(0);
});
