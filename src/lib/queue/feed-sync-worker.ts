/**
 * Feed Sync Worker — consumes feed-sync-queue jobs and runs the feed
 * engine. Scheduling uses per-destination BullMQ job schedulers
 * (upsertJobScheduler), managed by the destination CRUD service via
 * @/lib/queue/feed-sync-schedules, so no tenant fan-out enumeration is
 * required. Schedule upsert/removal helpers live in that separate module
 * (not here) so the CRUD service's dynamic import of them never
 * instantiates this file's live BullMQ Worker inside the web process.
 */
import { Worker, type Job } from "bullmq";
import { runFeedSync } from "@/lib/feeds/feed-sync.service";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

export interface FeedSyncJobData {
  tenantDb: string;
  tenantId: string;
  destinationId: string;
  mode: "delta" | "full" | "manual";
}

async function processJob(job: Job<FeedSyncJobData>) {
  const { tenantDb, tenantId, destinationId, mode } = job.data;
  if (!tenantDb || !destinationId) {
    throw new Error("feed-sync job missing tenantDb/destinationId");
  }
  const summary = await runFeedSync(tenantDb, tenantId, destinationId, mode);
  // A fully failed run should trigger BullMQ retries; partial/success should not.
  if (summary.status === "failed") {
    throw new Error(`Feed sync failed: ${summary.run_id}`);
  }
  return summary;
}

export const feedSyncWorker = new Worker<FeedSyncJobData>(
  "feed-sync-queue",
  processJob,
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 2,
    // Full catalog syncs can run long.
    lockDuration: 600_000,
    stalledInterval: 300_000,
    maxStalledCount: 1,
  }
);

feedSyncWorker.on("completed", (job, result) =>
  console.log(`[feed-sync] job ${job.id} done:`, JSON.stringify(result))
);
feedSyncWorker.on("failed", (job, err) =>
  console.error(`[feed-sync] job ${job?.id} failed:`, err.message)
);
