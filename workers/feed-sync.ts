/**
 * Feed Sync Worker
 * Consumes feed-sync-queue jobs (per-destination delta/full/manual syncs).
 *
 * Usage:
 *   pnpm worker:feed-sync
 *
 * Scheduling: per-destination BullMQ job schedulers, registered/updated by
 * the destination CRUD service via upsertFeedSchedules — no fan-out tick
 * needed here.
 */

import { feedSyncWorker } from "../src/lib/queue/feed-sync-worker";
import { closeAllConnections } from "../src/lib/db/connection-pool";

console.log("[feed-sync] worker started");

async function shutdown() {
  await feedSyncWorker.close();
  await closeAllConnections();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
