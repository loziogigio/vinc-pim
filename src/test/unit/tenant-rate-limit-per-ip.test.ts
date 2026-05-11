/**
 * Unit tests for the per-IP rate limiter.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory Redis mock with the surface area used by the limiter.
interface RedisOp {
  type: "get" | "incr" | "expire";
  key: string;
  ttl?: number;
}

const store = new Map<string, string>();
let opLog: RedisOp[] = [];

function reset() {
  store.clear();
  opLog = [];
}

function mockRedis() {
  return {
    get: vi.fn((key: string) => {
      opLog.push({ type: "get", key });
      return Promise.resolve(store.get(key) ?? null);
    }),
    incr: vi.fn((key: string) => {
      opLog.push({ type: "incr", key });
      const current = parseInt(store.get(key) ?? "0") + 1;
      store.set(key, String(current));
      return Promise.resolve(current);
    }),
    expire: vi.fn((key: string, ttl: number) => {
      opLog.push({ type: "expire", key, ttl });
      return Promise.resolve(1);
    }),
    decr: vi.fn((key: string) => {
      const current = parseInt(store.get(key) ?? "0") - 1;
      store.set(key, String(current));
      return Promise.resolve(current);
    }),
    pipeline: vi.fn(() => {
      const cmds: Array<() => Promise<unknown>> = [];
      const p = {
        get: (key: string) => {
          cmds.push(() => {
            opLog.push({ type: "get", key });
            return Promise.resolve(store.get(key) ?? null);
          });
          return p;
        },
        incr: (key: string) => {
          cmds.push(() => {
            opLog.push({ type: "incr", key });
            const current = parseInt(store.get(key) ?? "0") + 1;
            store.set(key, String(current));
            return Promise.resolve(current);
          });
          return p;
        },
        expire: (key: string, ttl: number) => {
          cmds.push(() => {
            opLog.push({ type: "expire", key, ttl });
            return Promise.resolve(1);
          });
          return p;
        },
        exec: async () => {
          const results: Array<[null, unknown]> = [];
          for (const c of cmds) results.push([null, await c()]);
          return results;
        },
      };
      return p;
    }),
  };
}

vi.mock("@/lib/cache/redis-client", () => ({
  getRedis: vi.fn(() => mockRedis()),
}));

import {
  checkPerIpRateLimit,
  getPerIpRateLimitStatus,
} from "@/lib/services/tenant-rate-limit.service";
import type { ITenantRateLimit } from "@/lib/db/models/admin-tenant";

const baseSettings: ITenantRateLimit = {
  enabled: false,
  requests_per_minute: 0,
  requests_per_day: 0,
  max_concurrent: 0,
  per_ip_enabled: true,
  // web tier
  per_ip_requests_per_minute: 5,
  per_ip_requests_per_day: 50,
  // api tier (distinct values so tests can tell which tier is in play)
  per_ip_api_requests_per_minute: 30,
  per_ip_api_requests_per_day: 300,
  per_ip_max_concurrent: 10,
  per_ip_allowlist: [],
};

describe("unit: tenant-rate-limit per-IP", () => {
  beforeEach(() => {
    reset();
  });

  it("allows when per_ip_enabled is false", async () => {
    const settings = { ...baseSettings, per_ip_enabled: false };
    const result = await checkPerIpRateLimit("acme", settings, "1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(opLog.length).toBe(0);
  });

  it("allows allowlisted IP and does NOT increment counters", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 1, per_ip_allowlist: ["1.2.3.0/24"] };
    for (let i = 0; i < 10; i++) {
      const r = await checkPerIpRateLimit("acme", settings, "1.2.3.99");
      expect(r.allowed).toBe(true);
    }
    expect(opLog.filter((o) => o.type === "incr").length).toBe(0);
    expect(opLog.filter((o) => o.type === "get").length).toBe(0);
  });

  it("buckets two different IPs independently", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 2 };
    const a = await checkPerIpRateLimit("acme", settings, "1.1.1.1");
    const b = await checkPerIpRateLimit("acme", settings, "2.2.2.2");
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    // Each IP is at 1 request, both still allowed.
    expect(a.limits.ip_minute?.current).toBe(1);
    expect(b.limits.ip_minute?.current).toBe(1);
  });

  it("blocks with ip_minute when per-minute cap exceeded", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 2 };
    await checkPerIpRateLimit("acme", settings, "9.9.9.9");
    await checkPerIpRateLimit("acme", settings, "9.9.9.9");
    const blocked = await checkPerIpRateLimit("acme", settings, "9.9.9.9");
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocked_by).toBe("ip_minute");
  });

  it("blocks with ip_day when daily cap exceeded", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 0, per_ip_requests_per_day: 1 };
    const ok = await checkPerIpRateLimit("acme", settings, "9.9.9.9");
    expect(ok.allowed).toBe(true);
    const blocked = await checkPerIpRateLimit("acme", settings, "9.9.9.9");
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocked_by).toBe("ip_day");
  });

  it("clamps 'unknown' bucket to a hardcoded floor of 5/min regardless of config", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 1000, per_ip_requests_per_day: 100000 };
    for (let i = 0; i < 5; i++) {
      const r = await checkPerIpRateLimit("acme", settings, "unknown");
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkPerIpRateLimit("acme", settings, "unknown");
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocked_by).toBe("ip_minute");
  });

  it("uses underscore-encoded IPv6 in keys", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 1 };
    await checkPerIpRateLimit("acme", settings, "2001:db8::1");
    const incrKeys = opLog.filter((o) => o.type === "incr").map((o) => o.key);
    expect(incrKeys.some((k) => k.includes("2001_db8__1"))).toBe(true);
    expect(incrKeys.some((k) => k.includes(":2001:db8::1"))).toBe(false);
  });

  it("does NOT increment when caps are 0 (unlimited)", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 0, per_ip_requests_per_day: 0 };
    await checkPerIpRateLimit("acme", settings, "5.5.5.5");
    expect(opLog.filter((o) => o.type === "incr").length).toBe(0);
  });

  it("getPerIpRateLimitStatus reports allowlisted=true without consuming", async () => {
    const settings = { ...baseSettings, per_ip_allowlist: ["10.0.0.0/8"] };
    const status = await getPerIpRateLimitStatus("acme", settings, "10.5.5.5");
    expect(status.allowlisted).toBe(true);
    expect(opLog.filter((o) => o.type === "incr").length).toBe(0);
  });

  it("getPerIpRateLimitStatus reports current counters", async () => {
    const settings = { ...baseSettings, per_ip_requests_per_minute: 100 };
    await checkPerIpRateLimit("acme", settings, "7.7.7.7");
    await checkPerIpRateLimit("acme", settings, "7.7.7.7");
    const status = await getPerIpRateLimitStatus("acme", settings, "7.7.7.7");
    expect(status.ip_minute.current).toBe(2);
    expect(status.ip_minute.limit).toBe(100);
  });

  // ── Tiers ──────────────────────────────────────────────────────────────

  it("default tier is 'web' and uses the web caps", async () => {
    const blocked = await (async () => {
      // web cap = 5
      for (let i = 0; i < 5; i++) await checkPerIpRateLimit("acme", baseSettings, "8.8.8.8");
      return checkPerIpRateLimit("acme", baseSettings, "8.8.8.8");
    })();
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocked_by).toBe("ip_minute");
    expect(blocked.limits.ip_minute?.limit).toBe(5);
  });

  it("'api' tier uses the api caps, not the web caps", async () => {
    // web cap is 5; api cap is 30 — 6 requests on the api tier must all pass
    for (let i = 0; i < 6; i++) {
      const r = await checkPerIpRateLimit("acme", baseSettings, "8.8.4.4", "api");
      expect(r.allowed).toBe(true);
    }
    const status = await getPerIpRateLimitStatus("acme", baseSettings, "8.8.4.4", "api");
    expect(status.tier).toBe("api");
    expect(status.ip_minute.limit).toBe(30);
    expect(status.ip_minute.current).toBe(6);
  });

  it("web and api counters are independent for the same IP", async () => {
    const ip = "172.16.0.9";
    // exhaust the web tier (cap 5)
    for (let i = 0; i < 5; i++) await checkPerIpRateLimit("acme", baseSettings, ip, "web");
    const webBlocked = await checkPerIpRateLimit("acme", baseSettings, ip, "web");
    expect(webBlocked.allowed).toBe(false);
    expect(webBlocked.blocked_by).toBe("ip_minute");
    // api tier for the same IP is untouched
    const apiOk = await checkPerIpRateLimit("acme", baseSettings, ip, "api");
    expect(apiOk.allowed).toBe(true);
    expect(apiOk.limits.ip_minute?.current).toBe(1);
    // and the two use different Redis keys
    const incrKeys = opLog.filter((o) => o.type === "incr").map((o) => o.key);
    expect(incrKeys.some((k) => k.includes(":ip:web:minute:"))).toBe(true);
    expect(incrKeys.some((k) => k.includes(":ip:api:minute:"))).toBe(true);
  });

  it("'unknown' IP clamp applies to the api tier too", async () => {
    // api cap is 30 but unknown clamps to 5/min
    for (let i = 0; i < 5; i++) {
      const r = await checkPerIpRateLimit("acme", baseSettings, "unknown", "api");
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkPerIpRateLimit("acme", baseSettings, "unknown", "api");
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocked_by).toBe("ip_minute");
    expect(blocked.limits.ip_minute?.limit).toBe(5);
  });
});
