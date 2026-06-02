/**
 * Order dashboard stats cache.
 *
 * The orders dashboard recomputes heavy aggregations (status breakdown, time
 * periods, previous-period comparison, daily revenue) over the tenant's order
 * set on every load. At ~1.5k orders/day/tenant on a shared Mongo, doing that
 * for every concurrent user / refresh / pagination overwhelms the DB.
 *
 * These stats describe a filter *scope* and barely change second-to-second, so
 * we cache the computed stats block in Redis with a short TTL keyed by
 * (tenant, scope). The orders LIST itself is never cached — it stays live.
 *
 * Fails OPEN: any Redis error just means "compute it" / "don't cache".
 * Tunable: ORDER_STATS_CACHE_TTL_SECONDS (default 60); set to 0 to disable.
 */
import { getRedis } from "@/lib/cache/redis-client";

const TTL_SECONDS = parseIntEnv("ORDER_STATS_CACHE_TTL_SECONDS", 60);
const ENABLED = TTL_SECONDS > 0;

function parseIntEnv(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

/** Deterministic 32-bit FNV-1a hash → short hex, to keep Redis keys compact. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Build a stable scope key from the search-free base query + the flags that
 * change the computed stats (compare / daily). Same scope → same key → shared
 * cache across users and pages.
 */
export function buildOrderStatsScopeKey(
  baseQuery: unknown,
  opts: { compare: boolean; daily: boolean },
): string {
  // baseQuery is built deterministically per request params; JSON is stable
  // enough for a 60s cache. Dates serialize to ISO strings.
  const payload =
    JSON.stringify(baseQuery) +
    `|c${opts.compare ? 1 : 0}|d${opts.daily ? 1 : 0}`;
  return fnv1a(payload);
}

function redisKey(tenantId: string, scopeKey: string): string {
  return `orderstats:${tenantId}:${scopeKey}`;
}

/** Returns the cached stats object, or null on miss / disabled / Redis error. */
export async function getCachedOrderStats(
  tenantId: string,
  scopeKey: string,
): Promise<Record<string, unknown> | null> {
  if (!ENABLED) return null;
  try {
    const raw = await getRedis().get(redisKey(tenantId, scopeKey));
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Store the stats object with the configured TTL. No-op on disabled / error. */
export async function setCachedOrderStats(
  tenantId: string,
  scopeKey: string,
  stats: Record<string, unknown>,
): Promise<void> {
  if (!ENABLED) return;
  try {
    await getRedis().set(
      redisKey(tenantId, scopeKey),
      JSON.stringify(stats),
      "EX",
      TTL_SECONDS,
    );
  } catch {
    /* fail open — never block the response on a cache write */
  }
}
