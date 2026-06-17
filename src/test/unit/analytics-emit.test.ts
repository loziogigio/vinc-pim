// vinc-commerce-suite/src/test/unit/analytics-emit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("unit: CS analytics emitter", () => {
  const OLD = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...OLD }; vi.restoreAllMocks(); });

  it("no-ops (returns false) when RS env is unset", async () => {
    delete process.env.RUDDERSTACK_WRITE_KEY;
    delete process.env.RUDDERSTACK_DATAPLANE_URL;
    const { emitEvent } = await import("@/lib/analytics/emit");
    const ok = await emitEvent({ event: "Audit Sold" });
    expect(ok).toBe(false);
  });

  it("calls serverTrack with the RS config when env is set", async () => {
    process.env.RUDDERSTACK_WRITE_KEY = "wk";
    process.env.RUDDERSTACK_DATAPLANE_URL = "https://events.example";
    const track = vi.fn(async () => true);
    vi.doMock("vinc-analytics/server", () => ({ serverTrack: track, serverIdentify: vi.fn() }));
    const { emitEvent } = await import("@/lib/analytics/emit");
    const ok = await emitEvent({ event: "Audit Sold", properties: { deal_id: "d1" } });
    expect(ok).toBe(true);
    expect(track).toHaveBeenCalledWith(
      { writeKey: "wk", dataPlaneUrl: "https://events.example" },
      expect.objectContaining({ event: "Audit Sold", properties: { deal_id: "d1" } })
    );
  });
});
