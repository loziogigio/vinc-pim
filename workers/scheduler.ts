/**
 * Job Scheduler
 * Two-tier scheduling system for campaigns and cleanup jobs
 *
 * Usage:
 *   pnpm worker:scheduler
 *
 * Architecture:
 * - PRIMARY: BullMQ delayed jobs (exact timing via scheduleCampaignJob)
 * - FALLBACK: This scheduler polls every 5 min to catch missed jobs
 *
 * This scheduler handles:
 * - Every 5 minutes: Fallback poll for scheduled campaigns (catches Redis restart, etc.)
 * - Daily at 3 AM: FCM token cleanup for all tenants
 *
 * Note: This is a lightweight scheduler that only queues jobs.
 * The actual work is done by the cleanup and notification workers.
 */

import {
  schedulePollForAllTenants,
  queueCampaignSend,
} from "../src/lib/queue/notification-worker";
import { scheduleCleanupForAllTenants } from "../src/lib/queue/cleanup-worker";

// Fallback polling interval (5 minutes)
// Primary scheduling uses BullMQ delayed jobs for exact timing
const FALLBACK_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_HOUR = 3; // 3 AM

let lastCleanupDate: string | null = null;

/**
 * Check if it's time for daily cleanup (3 AM)
 */
function shouldRunDailyCleanup(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const todayDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Run at 3 AM, once per day
  if (hour === CLEANUP_HOUR && lastCleanupDate !== todayDate) {
    lastCleanupDate = todayDate;
    return true;
  }

  return false;
}

/**
 * Main scheduler loop
 */
async function runScheduler(): Promise<void> {
  console.log("[Scheduler] Starting scheduler loop...");
  console.log("[Scheduler] Mode: Two-tier (PRIMARY: delayed jobs, FALLBACK: polling)");
  console.log(`[Scheduler] Fallback poll interval: ${FALLBACK_POLL_INTERVAL_MS / 60000} minutes`);
  console.log(`[Scheduler] Cleanup runs daily at ${CLEANUP_HOUR}:00`);

  // Initial fallback poll (catches any campaigns scheduled before scheduler started)
  try {
    console.log("[Scheduler] Running initial fallback poll...");
    await schedulePollForAllTenants();
  } catch (error) {
    console.error("[Scheduler] Initial poll error:", error);
  }

  // Main loop - fallback polling every 5 minutes
  setInterval(async () => {
    try {
      // Fallback poll for scheduled campaigns
      // Primary scheduling uses BullMQ delayed jobs
      await schedulePollForAllTenants();

      // Check for daily cleanup
      if (shouldRunDailyCleanup()) {
        console.log("[Scheduler] Running daily cleanup...");
        await scheduleCleanupForAllTenants();
      }
    } catch (error) {
      console.error("[Scheduler] Loop error:", error);
    }
  }, FALLBACK_POLL_INTERVAL_MS);
}

// Start the scheduler
console.log("[Scheduler] Starting...");
console.log(`[Scheduler] Redis: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`);

runScheduler().catch((error) => {
  console.error("[Scheduler] Fatal error:", error);
  process.exit(1);
});

// Keep the process running
process.on("SIGINT", () => {
  console.log("[Scheduler] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[Scheduler] Shutting down...");
  process.exit(0);
});

// Export for programmatic use
export { schedulePollForAllTenants, scheduleCleanupForAllTenants, queueCampaignSend };
