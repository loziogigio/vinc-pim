/**
 * Feed Sync Schedules — BullMQ job-scheduler upsert/removal for feed
 * destinations. Kept out of feed-sync-worker.ts (which instantiates a live
 * BullMQ Worker on import) so the destination CRUD service's dynamic import
 * of these helpers never spins up a worker inside the Next.js web process.
 */
import { feedSchedulerId, feedCronPatterns } from "@/lib/feeds/schedule";

const CRON_TZ = process.env.VINC_CRON_TZ || "Europe/Rome";

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
