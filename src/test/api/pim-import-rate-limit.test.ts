import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory fake of the ioredis surface the limiter uses:
 *   - pipeline: incr / expire / zremrangebyscore / zadd / zcard, then exec()
 *     returning [err, result] pairs in queue order.
 *   - direct: zrem (release + over-capacity hand-back), zadd / expire (heartbeat).
 */
const counters = new Map<string, number>();
const zsets = new Map<string, Map<string, number>>();
function zsetOf(key: string): Map<string, number> {
  if (!zsets.has(key)) zsets.set(key, new Map());
  return zsets.get(key)!;
}

function makeFakeRedis() {
  return {
    pipeline() {
      const ops: Array<() => [null, number]> = [];
      const chain: any = {
        incr(key: string) {
          ops.push(() => {
            const next = (counters.get(key) ?? 0) + 1;
            counters.set(key, next);
            return [null, next];
          });
          return chain;
        },
        expire() {
          ops.push(() => [null, 1]);
          return chain;
        },
        zremrangebyscore(key: string, min: number, max: number) {
          ops.push(() => {
            const z = zsetOf(key);
            let removed = 0;
            for (const [m, s] of z) {
              if (s >= min && s <= max) {
                z.delete(m);
                removed++;
              }
            }
            return [null, removed];
          });
          return chain;
        },
        zadd(key: string, score: number, member: string) {
          ops.push(() => {
            const z = zsetOf(key);
            const isNew = !z.has(member);
            z.set(member, score);
            return [null, isNew ? 1 : 0];
          });
          return chain;
        },
        zcard(key: string) {
          ops.push(() => [null, zsetOf(key).size]);
          return chain;
        },
        async exec() {
          return ops.map((op) => op());
        },
      };
      return chain;
    },
    async zrem(key: string, member: string) {
      return zsetOf(key).delete(member) ? 1 : 0;
    },
    async zadd(key: string, score: number, member: string) {
      zsetOf(key).set(member, score);
      return 1;
    },
    async expire() {
      return 1;
    },
  };
}

let fakeRedis: any = makeFakeRedis();
let throwOnGetRedis = false;

vi.mock("@/lib/cache/redis-client", () => ({
  getRedis: () => {
    if (throwOnGetRedis) throw new Error("redis down");
    return fakeRedis;
  },
}));

async function loadFresh() {
  vi.resetModules();
  return await import("@/lib/services/pim-import-rate-limit.service");
}

beforeEach(() => {
  counters.clear();
  zsets.clear();
  fakeRedis = makeFakeRedis();
  throwOnGetRedis = false;
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PIM import rate limit — request windows (per tenant)", () => {
  it("allows up to the per-minute cap, then blocks with Retry-After", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "100");
    vi.stubEnv("PIM_IMPORT_RATE_PER_HOUR", "6000");
    const { checkImportRateLimit } = await loadFresh();

    for (let i = 1; i <= 100; i++) {
      const r = await checkImportRateLimit("acme");
      expect(r.allowed).toBe(true);
      expect(r.minute.current).toBe(i);
    }

    const blocked = await checkImportRateLimit("acme");
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedBy).toBe("minute");
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps each tenant's budget independent (uniform but separate)", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "2");
    vi.stubEnv("PIM_IMPORT_RATE_PER_HOUR", "1000");
    const { checkImportRateLimit } = await loadFresh();

    await checkImportRateLimit("tenant-a");
    await checkImportRateLimit("tenant-a");
    expect((await checkImportRateLimit("tenant-a")).allowed).toBe(false);

    expect((await checkImportRateLimit("tenant-b")).allowed).toBe(true);
  });

  it("blocks on the hourly cap even when under the per-minute cap", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "100000");
    vi.stubEnv("PIM_IMPORT_RATE_PER_HOUR", "3");
    const { checkImportRateLimit } = await loadFresh();

    await checkImportRateLimit("acme");
    await checkImportRateLimit("acme");
    await checkImportRateLimit("acme");
    const blocked = await checkImportRateLimit("acme");

    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedBy).toBe("hour");
    expect(blocked.retryAfter).toBeLessThanOrEqual(3600);
  });

  it("fails OPEN when Redis is unavailable", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "1");
    const { checkImportRateLimit } = await loadFresh();
    throwOnGetRedis = true;
    expect((await checkImportRateLimit("acme")).allowed).toBe(true);
  });

  it("is disabled when both caps are 0", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "0");
    vi.stubEnv("PIM_IMPORT_RATE_PER_HOUR", "0");
    const { checkImportRateLimit } = await loadFresh();
    for (let i = 0; i < 50; i++) {
      expect((await checkImportRateLimit("acme")).allowed).toBe(true);
    }
  });

  it("falls back to the default cap when the env var is non-numeric (not disabled)", async () => {
    vi.stubEnv("PIM_IMPORT_RATE_PER_MIN", "abc"); // → default 100, NOT NaN/disabled
    vi.stubEnv("PIM_IMPORT_RATE_PER_HOUR", "1000000");
    const { checkImportRateLimit } = await loadFresh();

    for (let i = 0; i < 100; i++) {
      expect((await checkImportRateLimit("acme")).allowed).toBe(true);
    }
    expect((await checkImportRateLimit("acme")).allowed).toBe(false); // 101st blocked
  });
});

describe("PIM import rate limit — concurrency cap (per tenant)", () => {
  it("allows up to MAX_CONCURRENT in flight, then refuses", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "2");
    const { acquireImportSlot } = await loadFresh();

    const s1 = await acquireImportSlot("acme");
    const s2 = await acquireImportSlot("acme");
    const s3 = await acquireImportSlot("acme");

    expect(s1.acquired).toBe(true);
    expect(s2.acquired).toBe(true);
    expect(s3.acquired).toBe(false);
    expect(s3.limit).toBe(2);
    expect(s3.current).toBe(3); // counted, then handed back

    await s1.release();
    await s2.release();
  });

  it("frees capacity when a slot is released", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "2");
    const { acquireImportSlot } = await loadFresh();

    const s1 = await acquireImportSlot("acme");
    const s2 = await acquireImportSlot("acme");
    expect((await acquireImportSlot("acme")).acquired).toBe(false);

    await s1.release();
    expect((await acquireImportSlot("acme")).acquired).toBe(true);
    await s2.release();
  });

  it("release is idempotent (double release frees only one)", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "1");
    const { acquireImportSlot } = await loadFresh();

    const s1 = await acquireImportSlot("acme");
    expect(s1.acquired).toBe(true);
    await s1.release();
    await s1.release(); // no-op, must not over-credit capacity

    const s2 = await acquireImportSlot("acme");
    expect(s2.acquired).toBe(true);
    expect((await acquireImportSlot("acme")).acquired).toBe(false); // still capped at 1
    await s2.release();
  });

  it("evicts a leaked (stale) holder so capacity self-heals", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "1");
    vi.stubEnv("PIM_IMPORT_SLOT_STALE_SECONDS", "120");
    const { acquireImportSlot } = await loadFresh();

    // Seed a holder whose last heartbeat is ancient (crashed request).
    zsetOf("ratelimit:pimimport:acme:concurrent").set("ancient", 1);

    const s = await acquireImportSlot("acme");
    expect(s.acquired).toBe(true); // stale holder evicted, slot available
    expect(s.current).toBe(1);
    await s.release();
  });

  it("heartbeat keeps a long-running slot alive past the stale window", async () => {
    vi.useFakeTimers();
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "1");
    vi.stubEnv("PIM_IMPORT_SLOT_STALE_SECONDS", "120");
    vi.stubEnv("PIM_IMPORT_HEARTBEAT_SECONDS", "30");
    const { acquireImportSlot } = await loadFresh();

    const s1 = await acquireImportSlot("acme");
    expect(s1.acquired).toBe(true);

    // Run well past the 120s stale window; heartbeats (~30s) keep s1 fresh.
    await vi.advanceTimersByTimeAsync(300_000);

    const s2 = await acquireImportSlot("acme");
    expect(s2.acquired).toBe(false); // s1 still alive → cap=1 enforced

    await s1.release();
  });

  it("fails OPEN when Redis is unavailable", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "1");
    const { acquireImportSlot } = await loadFresh();
    throwOnGetRedis = true;
    expect((await acquireImportSlot("acme")).acquired).toBe(true);
  });

  it("is disabled only when BOTH per-tenant and global caps are 0", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "0");
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT_GLOBAL", "0");
    const { acquireImportSlot } = await loadFresh();
    for (let i = 0; i < 20; i++) {
      expect((await acquireImportSlot("acme")).acquired).toBe(true);
    }
  });

  it("enforces the GLOBAL cap across tenants even when per-tenant is generous", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "100"); // effectively no per-tenant limit
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT_GLOBAL", "2");
    const { acquireImportSlot } = await loadFresh();
    const a = await acquireImportSlot("acme");
    const b = await acquireImportSlot("beta"); // a different tenant
    const c = await acquireImportSlot("gamma"); // a third tenant
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
    expect(c.acquired).toBe(false); // global ceiling of 2 reached
    expect(c.blockedBy).toBe("global");
    await a.release();
    // freed global slot is reusable by any tenant
    expect((await acquireImportSlot("delta")).acquired).toBe(true);
  });

  it("falls back to the default cap when MAX_CONCURRENT is non-numeric (not disabled)", async () => {
    vi.stubEnv("PIM_IMPORT_MAX_CONCURRENT", "three"); // → default 3, NOT NaN/disabled
    const { acquireImportSlot } = await loadFresh();

    const s1 = await acquireImportSlot("acme");
    const s2 = await acquireImportSlot("acme");
    const s3 = await acquireImportSlot("acme");
    const s4 = await acquireImportSlot("acme");

    expect(s1.acquired && s2.acquired && s3.acquired).toBe(true);
    expect(s4.acquired).toBe(false);
    expect(s4.limit).toBe(3);

    await s1.release();
    await s2.release();
    await s3.release();
  });
});
