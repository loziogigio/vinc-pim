import { describe, it, expect } from "vitest";
import { EVENTS } from "vinc-analytics";
import { serverTrack, serverIdentify } from "vinc-analytics/server";

describe("unit: vinc-analytics vendored into CS", () => {
  it("resolves the shared taxonomy and server fns", () => {
    expect(EVENTS.AUDIT_SOLD).toBe("Audit Sold");
    expect(typeof serverTrack).toBe("function");
    expect(typeof serverIdentify).toBe("function");
  });
});
