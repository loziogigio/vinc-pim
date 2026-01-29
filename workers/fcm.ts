/**
 * FCM Notification Worker
 * Processes queued FCM notifications from BullMQ
 *
 * Usage:
 *   pnpm worker:fcm
 *   pnpm worker:fcm --tenant hidros-it
 */

import { Worker, Job } from "bullmq";
import { processQueuedFCM } from "../src/lib/fcm";
import type { FCMJobData } from "../src/lib/fcm/types";

interface FCMWorkerJobData extends FCMJobData {
  fcmLogId: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf("--tenant");

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

const { tenant } = parseArgs();
const filterTenantDb = tenant ? `vinc-${tenant}` : undefined;

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[FCM Worker] Starting...");
if (tenant) {
  console.log(`[FCM Worker] Filtering for tenant: ${tenant} (database: ${filterTenantDb})`);
}
console.log(`[FCM Worker] Redis: ${redisHost}:${redisPort}`);

const worker = new Worker(
  "fcm-notifications",
  async (job: Job<FCMWorkerJobData>) => {
    const { fcmLogId, tenantDb, tokenId, fcmToken, platform, payload, priority, badge, channelId, ttl } = job.data;

    // If filtering by tenant, skip jobs for other tenants
    if (filterTenantDb && tenantDb !== filterTenantDb) {
      console.log(`[FCM Worker] Skipping job ${job.id} (tenant: ${tenantDb}, filter: ${filterTenantDb})`);
      return { skipped: true, reason: "tenant_filter" };
    }

    console.log(`[FCM Worker] Processing job ${job.id} for FCM ${fcmLogId} (tenant: ${tenantDb}, platform: ${platform})`);

    const success = await processQueuedFCM({
      fcmLogId,
      tenantDb,
      tokenId,
      fcmToken,
      platform,
      payload,
      priority,
      badge,
      channelId,
      ttl
    });

    if (!success) {
      throw new Error(`Failed to send FCM notification ${fcmLogId}`);
    }

    return { fcmLogId, success, platform };
  },
  {
    connection: {
      host: redisHost,
      port: redisPort
    },
    concurrency: 20 // Higher concurrency for FCM (Firebase handles rate limiting)
  }
);

worker.on("completed", (job, result) => {
  if (result.skipped) {
    return; // Don't log skipped jobs
  }
  console.log(`[FCM Worker] Job ${job.id} completed: ${result.fcmLogId} sent (${result.platform})`);
});

worker.on("failed", (job, err) => {
  console.error(`[FCM Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[FCM Worker] Worker error:", err);
});

console.log("[FCM Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[FCM Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[FCM Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});
