/**
 * Feed Sync Worker — consumes feed-sync-queue jobs and runs the feed
 * engine. Scheduling uses per-destination BullMQ job schedulers
 * (upsertJobScheduler) managed by the destination CRUD service, so no
 * tenant fan-out enumeration is required.
 */
import { Worker, type Job } from "bullmq";
import { runFeedSync } from "@/lib/feeds/feed-sync.service";
import { feedSchedulerId, feedCronPatterns } from "@/lib/feeds/schedule";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const CRON_TZ = process.env.VINC_CRON_TZ || "Europe/Rome";

export interface FeedSyncJobData {
  tenantDb: string;
  tenantId: string;
  destinationId: string;
  mode: "delta" | "full" | "manual";
}

export async function upsertFeedSchedules(
  tenantDb: string,
  tenantId: string,
  dest: {
    destination_id: string;
    delta_interval_minutes: number;
    full_reconcile_hour: number;
    status: string;
  }
): Promise<void> {
  const { feedSyncQueue } = await import("./queues");
  if (dest.status === "paused") {
    await removeFeedSchedules(tenantDb, dest.destination_id);
    return;
  }
  const { delta, full } = feedCronPatterns(dest);
  const base = { tenantDb, tenantId, destinationId: dest.destination_id };
  await feedSyncQueue.upsertJobScheduler(
    feedSchedulerId(tenantDb, dest.destination_id, "delta"),
    { pattern: delta, tz: CRON_TZ },
    { name: "feed-sync", data: { ...base, mode: "delta" } }
  );
  await feedSyncQueue.upsertJobScheduler(
    feedSchedulerId(tenantDb, dest.destination_id, "full"),
    { pattern: full, tz: CRON_TZ },
    { name: "feed-sync", data: { ...base, mode: "full" } }
  );
}

export async function removeFeedSchedules(
  tenantDb: string,
  destinationId: string
): Promise<void> {
  const { feedSyncQueue } = await import("./queues");
  await feedSyncQueue.removeJobScheduler(
    feedSchedulerId(tenantDb, destinationId, "delta")
  );
  await feedSyncQueue.removeJobScheduler(
    feedSchedulerId(tenantDb, destinationId, "full")
  );
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
