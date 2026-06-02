/**
 * Sync-job priority tiers for the marketplace sync queues.
 *
 * BullMQ treats a LOWER number as MORE urgent (1 = highest priority).
 *
 * This is the single source of truth — every producer that enqueues a sync job
 * MUST use these constants instead of hard-coding a number, so the lanes stay
 * consistent and a bulk backfill can never out-rank an interactive change:
 *
 *   HIGH   realtime, user-triggered single-product changes (publish/edit/unpublish)
 *   NORMAL targeted multi-product ops (synonyms, category reindex, language enable)
 *   LOW    import-triggered bulk + delta catalog backfills — background only
 *
 * Bulk/LOW jobs are additionally routed to a separate queue (`sync-bulk-queue`)
 * drained by a low-concurrency worker, so they are both lower priority AND
 * bounded — they cannot saturate Solr even when interactive traffic is idle.
 */
export const SYNC_PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;

export type SyncPriorityLevel = "low" | "normal" | "high";

/**
 * Map a named priority level to its BullMQ numeric priority.
 * Unknown / undefined defaults to NORMAL.
 */
export function getPriorityValue(priority?: SyncPriorityLevel): number {
  switch (priority) {
    case "high":
      return SYNC_PRIORITY.HIGH;
    case "low":
      return SYNC_PRIORITY.LOW;
    case "normal":
    default:
      return SYNC_PRIORITY.NORMAL;
  }
}
