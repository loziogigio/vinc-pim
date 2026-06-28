import { describe, it, expect, vi, beforeEach } from "vitest";

const incr = vi.fn();
const expire = vi.fn();
vi.mock("@/lib/cache/redis-client", () => ({ getRedis: () => ({ incr, expire }) }));

import { enforceCustomSendCap } from "@/lib/notifications/custom-send-cap";

describe("enforceCustomSendCap", () => {
  beforeEach(() => { incr.mockReset(); expire.mockReset(); delete process.env.CUSTOM_NOTIFICATION_RATE_PER_MIN; });

  it("allows when under the default limit and sets TTL on first hit", async () => {
    incr.mockResolvedValue(1);
    const r = await enforceCustomSendCap("acme");
    expect(r.allowed).toBe(true);
    expect(expire).toHaveBeenCalledWith(expect.stringContaining("customsend:acme:"), 60);
  });

  it("blocks when over the limit", async () => {
    process.env.CUSTOM_NOTIFICATION_RATE_PER_MIN = "2";
    incr.mockResolvedValue(3);
    const r = await enforceCustomSendCap("acme");
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThanOrEqual(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("does not reset TTL on subsequent hits", async () => {
    incr.mockResolvedValue(5);
    await enforceCustomSendCap("acme");
    expect(expire).not.toHaveBeenCalled();
  });

  it("fails open when Redis throws", async () => {
    incr.mockRejectedValue(new Error("redis down"));
    const r = await enforceCustomSendCap("acme");
    expect(r.allowed).toBe(true);
  });

  it("allows the call at exactly the limit (count === limit)", async () => {
    process.env.CUSTOM_NOTIFICATION_RATE_PER_MIN = "2";
    incr.mockResolvedValue(2);
    const r = await enforceCustomSendCap("acme");
    expect(r.allowed).toBe(true);
  });
});
