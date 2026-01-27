/**
 * Push Notification Worker
 * Processes queued push notifications from BullMQ
 *
 * Usage:
 *   pnpm worker:push
 *   pnpm worker:push --tenant hidros-it
 */

import { Worker, Job } from "bullmq";
import { processQueuedPush } from "../src/lib/push";
import type { PushPayload } from "../src/lib/push/types";

interface PushJobData {
  pushLogId: string;
  tenantDb: string;
  subscriptionId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  payload: PushPayload;
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

console.log("[Push Worker] Starting...");
if (tenant) {
  console.log(`[Push Worker] Filtering for tenant: ${tenant} (database: ${filterTenantDb})`);
}
console.log(`[Push Worker] Redis: ${redisHost}:${redisPort}`);

const worker = new Worker(
  "push-notifications",
  async (job: Job<PushJobData>) => {
    const { pushLogId, tenantDb, subscriptionId, endpoint, keys, payload } = job.data;

    // If filtering by tenant, skip jobs for other tenants
    if (filterTenantDb && tenantDb !== filterTenantDb) {
      console.log(`[Push Worker] Skipping job ${job.id} (tenant: ${tenantDb}, filter: ${filterTenantDb})`);
      return { skipped: true, reason: "tenant_filter" };
    }

    console.log(`[Push Worker] Processing job ${job.id} for push ${pushLogId} (tenant: ${tenantDb})`);

    const success = await processQueuedPush({
      pushLogId,
      tenantDb,
      subscriptionId,
      endpoint,
      keys,
      payload
    });

    if (!success) {
      throw new Error(`Failed to send push notification ${pushLogId}`);
    }

    return { pushLogId, success };
  },
  {
    connection: {
      host: redisHost,
      port: redisPort
    },
    concurrency: 10 // Higher concurrency than email since push is faster
  }
);

worker.on("completed", (job, result) => {
  if (result.skipped) {
    return; // Don't log skipped jobs
  }
  console.log(`[Push Worker] Job ${job.id} completed: ${result.pushLogId} sent`);
});

worker.on("failed", (job, err) => {
  console.error(`[Push Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Push Worker] Worker error:", err);
});

console.log("[Push Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[Push Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Push Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});
