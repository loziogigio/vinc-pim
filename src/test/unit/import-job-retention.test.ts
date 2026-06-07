import { describe, it, expect } from "vitest";
import {
  buildImportJobDeleteFilter,
  resolvePolicy,
  DEFAULT_IMPORT_JOB_RETENTION_POLICY,
} from "@/lib/services/import-job-retention.service";

// The only statuses a prune is ever allowed to delete. Mirrors the service's
// internal TERMINAL_STATUSES; pending/processing jobs are never touched.
const TERMINAL = ["completed", "failed", "cancelled"];

describe("buildImportJobDeleteFilter — Mongo filter for deletable job docs", () => {
  it("count-cap mode (cutoff=null, no top-N): deletes ALL terminal docs", () => {
    // keepWithinDays=0 (window off) + keepLastN=0 → pure nuke of terminal logs.
    const filter = buildImportJobDeleteFilter(null, []);
    expect(filter).toEqual({ status: { $in: TERMINAL } });
  });

  it("count-cap mode with top-N: protects the newest N by _id, ignores age", () => {
    const filter = buildImportJobDeleteFilter(null, ["a", "b"]);
    expect(filter).toEqual({
      status: { $in: TERMINAL },
      _id: { $nin: ["a", "b"] },
    });
    // The whole point of the count-cap: no age clause, so recent jobs beyond N go too.
    expect(filter.created_at).toBeUndefined();
  });

  it("age-window mode (cutoff set): adds created_at < cutoff", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    const filter = buildImportJobDeleteFilter(cutoff, []);
    expect(filter).toEqual({
      status: { $in: TERMINAL },
      created_at: { $lt: cutoff },
    });
  });

  it("age-window + top-N: both clauses present", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    const filter = buildImportJobDeleteFilter(cutoff, ["a"]);
    expect(filter).toEqual({
      status: { $in: TERMINAL },
      created_at: { $lt: cutoff },
      _id: { $nin: ["a"] },
    });
  });

  it("never produces an unbounded _id:$in (the BSON 16MB failure mode)", () => {
    // Deletion is by-query; the only _id clause is the bounded $nin top-N guard.
    const filter = buildImportJobDeleteFilter(null, ["a", "b", "c"]);
    expect(filter._id).toEqual({ $nin: ["a", "b", "c"] });
    expect((filter._id as { $in?: unknown[] })?.$in).toBeUndefined();
  });
});

describe("resolvePolicy — honors 0, clamps, applies defaults", () => {
  it("honors keepWithinDays=0 (no age window) instead of forcing >=1", () => {
    expect(resolvePolicy({ keepWithinDays: 0, keepLastN: 5 }).keepWithinDays).toBe(0);
  });

  it("clamps negative values to 0", () => {
    const p = resolvePolicy({ keepWithinDays: -3, keepLastN: -5 });
    expect(p.keepWithinDays).toBe(0);
    expect(p.keepLastN).toBe(0);
  });

  it("falls back to the shipped defaults when fields are omitted", () => {
    expect(resolvePolicy({})).toEqual(DEFAULT_IMPORT_JOB_RETENTION_POLICY);
    expect(resolvePolicy(undefined)).toEqual(DEFAULT_IMPORT_JOB_RETENTION_POLICY);
  });
});

describe("DEFAULT_IMPORT_JOB_RETENTION_POLICY — shipped defaults (env unset in tests)", () => {
  it("keeps 30 days and the newest 1000 job-records by default", () => {
    // VINC_IMPORT_JOB_KEEP_DAYS / _KEEP_LAST_N override these at runtime; the test
    // env sets neither, so these are the baked-in fallbacks.
    expect(DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepWithinDays).toBe(30);
    expect(DEFAULT_IMPORT_JOB_RETENTION_POLICY.keepLastN).toBe(1000);
  });
});
