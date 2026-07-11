/**
 * SMS Worker
 * Processes queued SMS messages from BullMQ
 *
 * Usage:
 *   pnpm worker:sms
 *   pnpm worker:sms --tenant hidros-it
 */

import { Worker, Job } from "bullmq";
import { processQueuedSms } from "../src/lib/sms";
import { closeAllConnections } from "../src/lib/db/connection-pool";

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
const tenantDb = tenant ? `vinc-${tenant}` : undefined;

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[SMS Worker] Starting...");
if (tenant) {
  console.log(`[SMS Worker] Target tenant: ${tenant} (database: ${tenantDb})`);
}
console.log(`[SMS Worker] Redis: ${redisHost}:${redisPort}`);

const worker = new Worker(
  "sms",
  async (job: Job<{ smsLogId: string; tenantDb?: string }>) => {
    const { smsLogId, tenantDb: jobTenantDb } = job.data;
    // Use tenant from job data, or fallback to worker CLI arg
    const effectiveTenantDb = jobTenantDb || tenantDb;

    console.log(
      `[SMS Worker] Processing job ${job.id} for smsLogId ${smsLogId} (tenant: ${effectiveTenantDb || "not specified"})`
    );

    if (!effectiveTenantDb) {
      throw new Error(
        "No tenant database specified. Either pass --tenant to worker or ensure job data includes tenantDb."
      );
    }

    const result = await processQueuedSms(smsLogId, effectiveTenantDb);

    if (!result.ok) {
      throw new Error(result.error || "Failed to send SMS");
    }

    return result;
  },
  {
    connection: {
      host: redisHost,
      port: redisPort,
    },
    concurrency: 5,
  }
);

worker.on("completed", (job, result) => {
  console.log(`[SMS Worker] Job ${job.id} completed: smsLogId ${result.logId} sent`);
});

worker.on("failed", (job, err) => {
  console.error(`[SMS Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[SMS Worker] Worker error:", err);
});

console.log("[SMS Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[SMS Worker] Shutting down...");
  await worker.close();
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[SMS Worker] Shutting down...");
  await worker.close();
  await closeAllConnections();
  process.exit(0);
});
