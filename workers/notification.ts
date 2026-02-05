/**
 * Notification Scheduler Worker
 * Processes scheduled campaigns and notification jobs
 *
 * Usage:
 *   pnpm worker:notification
 *
 * This worker handles:
 * - Polling for scheduled campaigns that are due
 * - Sending campaigns immediately when queued
 */

import { notificationWorker } from "../src/lib/queue/notification-worker";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Notification Worker] Starting...");
console.log(`[Notification Worker] Redis: ${redisHost}:${redisPort}`);

// Worker is already created and listening via the import
console.log("[Notification Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[Notification Worker] Shutting down...");
  await notificationWorker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Notification Worker] Shutting down...");
  await notificationWorker.close();
  process.exit(0);
});
