/**
 * Booking Hold Expiry Worker
 * Processes delayed jobs to expire held bookings
 *
 * Usage:
 *   pnpm worker:booking-expiry
 */

import { bookingExpiryWorker } from "../src/lib/queue/booking-expiry-worker";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Booking Expiry Worker] Starting...");
console.log(`[Booking Expiry Worker] Redis: ${redisHost}:${redisPort}`);

// Worker is already created and listening via the import
console.log("[Booking Expiry Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[Booking Expiry Worker] Shutting down...");
  await bookingExpiryWorker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Booking Expiry Worker] Shutting down...");
  await bookingExpiryWorker.close();
  process.exit(0);
});
