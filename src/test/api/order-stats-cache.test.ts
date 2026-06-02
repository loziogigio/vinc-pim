import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory fake of the ioredis surface the cache uses: get + set EX.
const store = new Map<string, string>();
let throwOnGetRedis = false;
const fakeRedis = {
  async get(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  async set(key: string, val: string, _ex: string, _ttl: number) {
    store.set(key, val);
    return "OK";
  },
};

vi.mock("@/lib/cache/redis-client", () => ({
  getRedis: () => {
    if (throwOnGetRedis) throw new Error("redis down");
    return fakeRedis;
  },
}));

async function loadFresh() {
  vi.resetModules();
  return await import("@/lib/services/order-stats-cache");
}

beforeEach(() => {
  store.clear();
  throwOnGetRedis = false;
  vi.unstubAllEnvs();
});
afterEach(() => vi.restoreAllMocks());

describe("order-stats-cache scope key", () => {
  it("is stable for the same scope and flags", async () => {
    const { buildOrderStatsScopeKey } = await loadFresh();
    const q = { tenant_id: "dfl-it", channel: "b2b" };
    expect(buildOrderStatsScopeKey(q, { compare: true, daily: true })).toBe(
      buildOrderStatsScopeKey({ tenant_id: "dfl-it", channel: "b2b" }, { compare: true, daily: true }),
    );
  });

  it("differs when scope or flags differ", async () => {
    const { buildOrderStatsScopeKey } = await loadFresh();
    const base = buildOrderStatsScopeKey({ tenant_id: "a" }, { compare: false, daily: false });
    expect(buildOrderStatsScopeKey({ tenant_id: "b" }, { compare: false, daily: false })).not.toBe(base);
    expect(buildOrderStatsScopeKey({ tenant_id: "a" }, { compare: true, daily: false })).not.toBe(base);
    expect(buildOrderStatsScopeKey({ tenant_id: "a" }, { compare: false, daily: true })).not.toBe(base);
  });
});

describe("order-stats-cache get/set", () => {
  it("round-trips the stats object", async () => {
    vi.stubEnv("ORDER_STATS_CACHE_TTL_SECONDS", "60");
    const { getCachedOrderStats, setCachedOrderStats } = await loadFresh();

    expect(await getCachedOrderStats("dfl-it", "k1")).toBeNull();
    await setCachedOrderStats("dfl-it", "k1", { total: 42, draft: 3 });
    expect(await getCachedOrderStats("dfl-it", "k1")).toEqual({ total: 42, draft: 3 });
  });

  it("keys cache per tenant", async () => {
    vi.stubEnv("ORDER_STATS_CACHE_TTL_SECONDS", "60");
    const { getCachedOrderStats, setCachedOrderStats } = await loadFresh();
    await setCachedOrderStats("tenant-a", "k", { total: 1 });
    expect(await getCachedOrderStats("tenant-b", "k")).toBeNull();
  });

  it("is disabled when TTL is 0 (always miss, never stores)", async () => {
    vi.stubEnv("ORDER_STATS_CACHE_TTL_SECONDS", "0");
    const { getCachedOrderStats, setCachedOrderStats } = await loadFresh();
    await setCachedOrderStats("dfl-it", "k", { total: 9 });
    expect(store.size).toBe(0);
    expect(await getCachedOrderStats("dfl-it", "k")).toBeNull();
  });

  it("fails OPEN (returns null) when Redis throws", async () => {
    vi.stubEnv("ORDER_STATS_CACHE_TTL_SECONDS", "60");
    const { getCachedOrderStats, setCachedOrderStats } = await loadFresh();
    throwOnGetRedis = true;
    expect(await getCachedOrderStats("dfl-it", "k")).toBeNull();
    await expect(setCachedOrderStats("dfl-it", "k", { total: 1 })).resolves.toBeUndefined();
  });
});
