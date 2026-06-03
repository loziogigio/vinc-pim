/**
 * Unit tests for the submit/resubmit concurrency-lock staleness logic.
 *
 * Background: /submit and /resubmit atomically claim an order by setting
 * `submitting: true`, and a `finally` block is supposed to clear it on every
 * exit path. When the request handler dies before `finally` runs (dev
 * hot-reload, deploy, hard crash), the flag stays `true` forever and the order
 * can never be submitted again — it returns 409 "already being submitted"
 * permanently (observed on dfl-it order dR0-ZLBQyeGp, stuck 3h+).
 *
 * Fix: stamp `submitting_at` when claiming, and treat a lock older than
 * SUBMIT_LOCK_TTL_MS — or one with no timestamp at all (legacy stuck rows) —
 * as stale and reclaimable. These tests pin that contract.
 */

import { describe, it, expect } from "vitest";
import {
  isSubmitLockActive,
  claimableSubmitLockFilter,
} from "@/lib/utils/submit-lock";
import { SUBMIT_LOCK_TTL_MS } from "@/lib/constants/order";

const NOW = new Date("2026-06-03T10:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("isSubmitLockActive", () => {
  it("is inactive when submitting is false/absent", () => {
    expect(isSubmitLockActive({ submitting: false }, NOW)).toBe(false);
    expect(isSubmitLockActive({}, NOW)).toBe(false);
    expect(isSubmitLockActive(null, NOW)).toBe(false);
  });

  it("is inactive for a legacy lock with no timestamp (never-stamped, stuck)", () => {
    expect(isSubmitLockActive({ submitting: true }, NOW)).toBe(false);
  });

  it("is active for a fresh lock just claimed", () => {
    expect(isSubmitLockActive({ submitting: true, submitting_at: NOW }, NOW)).toBe(true);
  });

  it("is active while still within the TTL window", () => {
    const recent = ago(SUBMIT_LOCK_TTL_MS / 2);
    expect(isSubmitLockActive({ submitting: true, submitting_at: recent }, NOW)).toBe(true);
  });

  it("is inactive (stale) once the lock is older than the TTL", () => {
    const old = ago(SUBMIT_LOCK_TTL_MS * 2);
    expect(isSubmitLockActive({ submitting: true, submitting_at: old }, NOW)).toBe(false);
  });
});

// Minimal evaluator for the Mongo operators used by claimableSubmitLockFilter,
// so we can prove the DB filter reclaims exactly the locks isSubmitLockActive
// reports as inactive — without standing up MongoDB.
function matchesFilter(filter: Record<string, unknown>, doc: Record<string, unknown>): boolean {
  if (Array.isArray((filter as { $or?: unknown }).$or)) {
    return (filter.$or as Record<string, unknown>[]).some((f) => matchesFilter(f, doc));
  }
  return Object.entries(filter).every(([field, cond]) => {
    const v = doc[field];
    if (cond && typeof cond === "object") {
      const c = cond as Record<string, unknown>;
      if ("$ne" in c) return v !== c.$ne;
      if ("$exists" in c) return (v !== undefined && v !== null) === c.$exists;
      if ("$lt" in c) return v != null && new Date(v as string).getTime() < new Date(c.$lt as string).getTime();
    }
    return v === cond;
  });
}

describe("claimableSubmitLockFilter", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["no submitting flag", {}],
    ["submitting false", { submitting: false }],
    ["legacy lock without timestamp", { submitting: true }],
    ["fresh lock", { submitting: true, submitting_at: NOW }],
    ["recent lock within TTL", { submitting: true, submitting_at: ago(SUBMIT_LOCK_TTL_MS / 2) }],
    ["stale lock past TTL", { submitting: true, submitting_at: ago(SUBMIT_LOCK_TTL_MS * 2) }],
  ];

  it("matches exactly the orders whose lock is NOT active", () => {
    const filter = claimableSubmitLockFilter(NOW);
    for (const [label, doc] of cases) {
      const reclaimable = matchesFilter(filter, doc);
      expect(reclaimable, label).toBe(!isSubmitLockActive(doc, NOW));
    }
  });

  it("derives the stale cutoff from the TTL constant", () => {
    const filter = claimableSubmitLockFilter(NOW) as { $or: Array<Record<string, { $lt?: Date }>> };
    const ltClause = filter.$or.find((c) => c.submitting_at?.$lt);
    expect(ltClause?.submitting_at?.$lt?.getTime()).toBe(NOW.getTime() - SUBMIT_LOCK_TTL_MS);
  });
});
