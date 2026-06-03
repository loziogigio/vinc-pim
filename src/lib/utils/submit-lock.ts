/**
 * Stale-aware concurrency lock helpers for order submit / resubmit.
 *
 * `/submit` and `/resubmit` claim an order by setting `submitting: true` and
 * rely on a `finally` block to clear it. If the handler dies before `finally`
 * runs (dev hot-reload, deploy, crash), the flag stays `true` and the order
 * wedges — it can never be submitted again (permanent 409). To self-heal, the
 * claim now also stamps `submitting_at`; a lock older than SUBMIT_LOCK_TTL_MS,
 * or one with no timestamp (legacy stuck rows), is considered stale and can be
 * reclaimed by the next submit.
 */

import { SUBMIT_LOCK_TTL_MS } from "@/lib/constants/order";

export interface SubmitLockState {
  submitting?: boolean;
  submitting_at?: Date | string | null;
}

/**
 * True when an order is genuinely mid-submission right now — i.e. the lock is
 * held AND was stamped within the TTL. A held-but-unstamped or expired lock is
 * stale (the claiming request died) and is NOT active.
 */
export function isSubmitLockActive(
  order: SubmitLockState | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!order?.submitting) return false;
  if (!order.submitting_at) return false; // legacy / never-stamped → stale
  const stampedAt = new Date(order.submitting_at).getTime();
  return stampedAt >= now.getTime() - SUBMIT_LOCK_TTL_MS;
}

/**
 * Mongo filter fragment that matches an order whose submit lock is free or
 * stale (and therefore claimable). AND this into the route's claim query
 * alongside `order_id` / `status` so a wedged order self-heals on retry.
 *
 * Mirrors `isSubmitLockActive`: an order is claimable iff its lock is not
 * active — free (`submitting != true`), unstamped, or stamped before the TTL
 * cutoff.
 */
export function claimableSubmitLockFilter(now: Date = new Date()) {
  const staleBefore = new Date(now.getTime() - SUBMIT_LOCK_TTL_MS);
  return {
    $or: [
      { submitting: { $ne: true } },
      { submitting_at: { $exists: false } },
      { submitting_at: { $lt: staleBefore } },
    ],
  };
}
