/**
 * Email Worker
 * Processes queued emails from BullMQ
 *
 * Usage:
 *   pnpm worker:email
 *   pnpm worker:email --tenant hidros-it
 *   pnpm worker:email --tenant dfl-eventi-it
 */

import { Worker, Job } from "bullmq";
import { processQueuedEmail } from "../src/lib/email";
import { connectToDatabase } from "../src/lib/db/connection";

/**
 * Parse command line arguments
 */
function parseArgs(): { tenant?: string } {
  const args = process.argv.slice(2);
  const tenantIndex = args.indexOf('--tenant');

  if (tenantIndex >= 0 && args[tenantIndex + 1]) {
    return { tenant: args[tenantIndex + 1] };
  }

  return {};
}

const { tenant } = parseArgs();
const tenantDb = tenant ? `vinc-${tenant}` : undefined;

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Email Worker] Starting...");
if (tenant) {
  console.log(`[Email Worker] Target tenant: ${tenant} (database: ${tenantDb})`);
}
console.log(`[Email Worker] Redis: ${redisHost}:${redisPort}`);

const worker = new Worker(
  "email",
  async (job: Job<{ emailId: string }>) => {
    const { emailId } = job.data;
    console.log(`[Email Worker] Processing job ${job.id} for email ${emailId}`);

    const result = await processQueuedEmail(emailId);

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
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
  console.log(`[Email Worker] Job ${job.id} completed: ${result.emailId} sent`);
});

worker.on("failed", (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Email Worker] Worker error:", err);
});

console.log("[Email Worker] Ready and listening for jobs");

// Keep the process running
process.on("SIGINT", async () => {
  console.log("[Email Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Email Worker] Shutting down...");
  await worker.close();
  process.exit(0);
});
