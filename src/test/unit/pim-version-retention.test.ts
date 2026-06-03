import { describe, it, expect } from "vitest";
import {
  selectVersionsToDelete,
  type VersionMeta,
} from "@/lib/pim/version-retention.service";

// Build one version's metadata. The service always feeds versions sorted
// NEWEST-FIRST (version desc), so test arrays are written in that order.
function v(id: string, opts: Partial<VersionMeta> = {}): VersionMeta {
  return {
    _id: id,
    isCurrent: false,
    isCurrentPublished: false,
    created_at: null,
    ...opts,
  };
}

describe("selectVersionsToDelete — count cap (cutoff = null)", () => {
  it("keeps the newest N and deletes the older rest", () => {
    const versions = [
      v("12", { isCurrent: true }),
      ...Array.from({ length: 11 }, (_, i) => v(String(11 - i))), // 11..1
    ];
    const del = selectVersionsToDelete(versions, 10, null).map(String);
    expect(del).toEqual(["2", "1"]); // 12 - 10, the two oldest
    expect(del).not.toContain("12"); // current kept
  });

  it("deletes nothing when versions <= N", () => {
    const versions = [v("3", { isCurrent: true }), v("2"), v("1")];
    expect(selectVersionsToDelete(versions, 10, null)).toEqual([]);
  });

  it("protects isCurrent even when it is NOT among the newest N (current != max version)", () => {
    const versions = [
      ...Array.from({ length: 11 }, (_, i) => v(String(100 - i))), // 100..90
      v("1", { isCurrent: true }), // oldest, but current
    ];
    const del = selectVersionsToDelete(versions, 10, null).map(String);
    expect(del).not.toContain("1"); // protected by the flag, not position
    expect(del).toEqual(["90"]); // newest 10 (100..91) kept; 90 is the only deletable
  });

  it("protects isCurrentPublished beyond N (the rollback-orphan case)", () => {
    const versions = [
      ...Array.from({ length: 11 }, (_, i) => v(String(100 - i))),
      v("1", { isCurrentPublished: true }), // stale published doc left by a rollback
    ];
    const del = selectVersionsToDelete(versions, 10, null).map(String);
    expect(del).not.toContain("1");
    expect(del).toEqual(["90"]);
  });

  it("ignores age entirely (deletes recent versions beyond N)", () => {
    const recent = new Date(Date.now() - 1000);
    const versions = [
      v("12", { isCurrent: true, created_at: recent }),
      ...Array.from({ length: 11 }, (_, i) => v(String(11 - i), { created_at: recent })),
    ];
    const del = selectVersionsToDelete(versions, 10, null).map(String);
    expect(del).toEqual(["2", "1"]); // deleted despite being seconds old
  });
});

describe("selectVersionsToDelete — age window (cutoff set, scheduled-prune behavior)", () => {
  it("keeps recent versions beyond N but deletes old ones", () => {
    const now = Date.now();
    const recent = new Date(now - 1000);
    const old = new Date(now - 1000 * 60 * 60 * 24 * 365); // ~1 year
    const versions = [
      v("12", { isCurrent: true, created_at: recent }),
      ...Array.from({ length: 9 }, (_, i) => v(String(11 - i), { created_at: recent })), // 11..3
      v("2", { created_at: recent }), // beyond N but recent
      v("1", { created_at: old }), // beyond N and old
    ];
    const cutoff = new Date(now - 1000 * 60 * 60 * 24 * 30); // 30 days
    const del = selectVersionsToDelete(versions, 10, cutoff).map(String);
    expect(del).toContain("1"); // old → deleted
    expect(del).not.toContain("2"); // recent → protected by age window
  });
});
