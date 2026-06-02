import { describe, expect, it } from "vitest";
import { SYNC_PRIORITY, getPriorityValue } from "@/lib/constants/sync-priority";

describe("sync priority tiers", () => {
  it("orders tiers so lower number = more urgent (high < normal < low)", () => {
    expect(SYNC_PRIORITY.HIGH).toBeLessThan(SYNC_PRIORITY.NORMAL);
    expect(SYNC_PRIORITY.NORMAL).toBeLessThan(SYNC_PRIORITY.LOW);
  });

  it("uses the documented 3-tier values (1 / 5 / 10)", () => {
    expect(SYNC_PRIORITY).toEqual({ HIGH: 1, NORMAL: 5, LOW: 10 });
  });

  it("maps named levels to their numeric priority", () => {
    expect(getPriorityValue("high")).toBe(SYNC_PRIORITY.HIGH);
    expect(getPriorityValue("normal")).toBe(SYNC_PRIORITY.NORMAL);
    expect(getPriorityValue("low")).toBe(SYNC_PRIORITY.LOW);
  });

  it("defaults unknown/undefined to NORMAL", () => {
    expect(getPriorityValue()).toBe(SYNC_PRIORITY.NORMAL);
    expect(getPriorityValue(undefined)).toBe(SYNC_PRIORITY.NORMAL);
  });

  it("keeps bulk (LOW) strictly below interactive (HIGH) so a backfill never out-ranks a publish", () => {
    expect(SYNC_PRIORITY.LOW).toBeGreaterThan(SYNC_PRIORITY.HIGH);
  });
});
