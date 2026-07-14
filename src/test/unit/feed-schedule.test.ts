import { describe, it, expect } from "vitest";
import { feedSchedulerId, feedCronPatterns } from "@/lib/feeds/schedule";

describe("feed scheduling helpers", () => {
  it("builds stable scheduler ids", () => {
    expect(feedSchedulerId("vinc-deodato-it", "fd_1", "delta")).toBe(
      "feed-delta-vinc-deodato-it-fd_1"
    );
    expect(feedSchedulerId("vinc-deodato-it", "fd_1", "full")).toBe(
      "feed-full-vinc-deodato-it-fd_1"
    );
  });

  it("derives cron patterns from destination settings", () => {
    expect(feedCronPatterns({ delta_interval_minutes: 15, full_reconcile_hour: 2 })).toEqual({
      delta: "*/15 * * * *",
      full: "0 2 * * *",
    });
    // >= 60 min rounds to whole hours
    expect(feedCronPatterns({ delta_interval_minutes: 120, full_reconcile_hour: 4 })).toEqual({
      delta: "0 */2 * * *",
      full: "0 4 * * *",
    });
    // 60 exactly -> hourly
    expect(feedCronPatterns({ delta_interval_minutes: 60, full_reconcile_hour: 0 })).toEqual({
      delta: "0 */1 * * *",
      full: "0 0 * * *",
    });
  });
});
