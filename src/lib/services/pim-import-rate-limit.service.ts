/**
 * PIM Import Rate Limit
 *
 * Per-tenant burst smoothing for the PIM import ingestion endpoint.
 *
 * Problem: a client can fire a burst (e.g. 100 requests × 500 items in a few
 * seconds), and/or run many large imports at once. Each request drives heavy
 * MongoDB writes, so unthrottled traffic spikes the shared DB and starves order
 * processing and product search.
 *
 * Fix: a uniform per-tenant budget — every tenant gets the SAME allowance,
 * keyed independently, enforced server-side before any DB work:
 *   - PIM_IMPORT_RATE_PER_MIN    requests per 60s    (default 100)
 *   - PIM_IMPORT_RATE_PER_HOUR   requests per hour   (default 6000)
 *   - PIM_IMPORT_MAX_CONCURRENT  simultaneous imports (default 3) ← strongest DB guard
 *
 * Implementation notes:
 *   - Fixed-window request counters in Redis (shared across API replicas).
 *   - Concurrency via a Redis sorted set: each in-flight request is a member
 *     scored by a timestamp it keeps refreshing (heartbeat). On acquire we evict
 *     members whose last heartbeat is older than PIM_IMPORT_SLOT_STALE_SECONDS
 *     (a crashed request that stopped refreshing), then add ourselves and count.
 *     The heartbeat is why a long but healthy import is never mistaken for a
 *     crashed one and wrongly evicted (which would breach the cap).
 *   - All limits read via envInt(): a non-numeric value falls back to the safe
 *     default and logs, instead of NaN silently disabling protection.
 *   - Fails OPEN: a Redis outage must never block legitimate ingestion.
 */
import { getRedis } from "@/lib/cache/redis-client";

/**
 * Parse an integer env var, falling back to `def` (with a loud log) for unset,
 * empty, or non-numeric values. Never returns NaN — a config typo must not
 * silently disable a limit.
 */
function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const trimmed = raw.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || String(n) !== trimmed) {
    console.error(
      `[pim-import-rate-limit] invalid ${name}="${raw}", using default ${def}`
    );
    return def;
  }
  return n;
}

const PER_MINUTE = envInt("PIM_IMPORT_RATE_PER_MIN", 100);
const PER_HOUR = envInt("PIM_IMPORT_RATE_PER_HOUR", 6000);

// Max simultaneous in-flight imports per tenant. The most direct MongoDB guard:
// it bounds how many heavy imports write at once, independent of arrival rate.
// 0 disables the concurrency gate.
const MAX_CONCURRENT = envInt("PIM_IMPORT_MAX_CONCURRENT", 3);
// Global ceiling across ALL tenants — bounds total in-flight imports so N tenants
// each at their per-tenant limit can't aggregate into a shared-DB overload. 0 disables.
const MAX_CONCURRENT_GLOBAL = envInt("PIM_IMPORT_MAX_CONCURRENT_GLOBAL", 8);
// A holder whose heartbeat is older than this is treated as crashed and evicted,
// so capacity self-heals. Healthy imports refresh well within this window.
const SLOT_STALE_SECONDS = envInt("PIM_IMPORT_SLOT_STALE_SECONDS", 120);
// How often a holder refreshes its heartbeat. Clamped to at most half the stale
// window so a live holder can miss a beat (GC, slow tick) without being evicted.
const HEARTBEAT_MS =
  Math.max(1, Math.min(envInt("PIM_IMPORT_HEARTBEAT_SECONDS", 30), Math.floor(SLOT_STALE_SECONDS / 2))) * 1000;
const SLOT_KEY_TTL = SLOT_STALE_SECONDS + 60;

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3600;

export interface ImportRateLimitResult {
  allowed: boolean;
  blockedBy?: "minute" | "hour";
  /** Seconds until the blocking window resets (0 when allowed). */
  retryAfter: number;
  minute: { current: number; limit: number };
  hour: { current: number; limit: number };
}

function windowStart(sizeSeconds: number, nowSeconds: number): number {
  return nowSeconds - (nowSeconds % sizeSeconds);
}

/**
 * Check-and-consume the per-tenant PIM import request budget for one request.
 *
 * Atomic INCR-then-check: every request increments first, so the Nth concurrent
 * request sees count=N (no thundering-herd gap). Rejected requests still count,
 * which only makes the limiter stricter under abuse; the window key is pinned to
 * the window start, so it frees at the boundary.
 *
 * Fails OPEN on Redis errors.
 *
 * @param tenantKey stable per-tenant identifier (tenant id, or `vinc-<id>` db)
 */
export async function checkImportRateLimit(
  tenantKey: string
): Promise<ImportRateLimitResult> {
  const minuteEnabled = PER_MINUTE > 0;
  const hourEnabled = PER_HOUR > 0;

  if (!minuteEnabled && !hourEnabled) {
    return {
      allowed: true,
      retryAfter: 0,
      minute: { current: 0, limit: PER_MINUTE },
      hour: { current: 0, limit: PER_HOUR },
    };
  }

  try {
    const r = getRedis();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const minuteStart = windowStart(MINUTE_SECONDS, nowSeconds);
    const hourStart = windowStart(HOUR_SECONDS, nowSeconds);
    const minuteKey = `ratelimit:pimimport:${tenantKey}:min:${minuteStart}`;
    const hourKey = `ratelimit:pimimport:${tenantKey}:hour:${hourStart}`;

    const pipeline = r.pipeline();
    if (minuteEnabled) {
      pipeline.incr(minuteKey);
      pipeline.expire(minuteKey, MINUTE_SECONDS + 5);
    }
    if (hourEnabled) {
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, HOUR_SECONDS + 60);
    }
    const res = await pipeline.exec();

    let idx = 0;
    let minuteCount = 0;
    let hourCount = 0;
    if (minuteEnabled) {
      minuteCount = Number(res?.[idx]?.[1] ?? 0);
      idx += 2;
    }
    if (hourEnabled) {
      hourCount = Number(res?.[idx]?.[1] ?? 0);
      idx += 2;
    }

    const minuteOver = minuteEnabled && minuteCount > PER_MINUTE;
    const hourOver = hourEnabled && hourCount > PER_HOUR;

    if (minuteOver || hourOver) {
      const minuteReset = minuteStart + MINUTE_SECONDS - nowSeconds;
      const hourReset = hourStart + HOUR_SECONDS - nowSeconds;
      const blockByHour = hourOver && (!minuteOver || hourReset > minuteReset);
      return {
        allowed: false,
        blockedBy: blockByHour ? "hour" : "minute",
        retryAfter: Math.max(1, blockByHour ? hourReset : minuteReset),
        minute: { current: minuteCount, limit: PER_MINUTE },
        hour: { current: hourCount, limit: PER_HOUR },
      };
    }

    return {
      allowed: true,
      retryAfter: 0,
      minute: { current: minuteCount, limit: PER_MINUTE },
      hour: { current: hourCount, limit: PER_HOUR },
    };
  } catch (err) {
    console.error(
      "[pim-import-rate-limit] check failed, allowing request:",
      (err as Error).message
    );
    return {
      allowed: true,
      retryAfter: 0,
      minute: { current: 0, limit: PER_MINUTE },
      hour: { current: 0, limit: PER_HOUR },
    };
  }
}

export interface ImportSlot {
  /** Whether a concurrency slot was secured (false = at capacity, send 429). */
  acquired: boolean;
  /** Concurrent in-flight count for the dimension that decided the result. */
  current: number;
  limit: number;
  /** Which ceiling rejected the request, when acquired=false. */
  blockedBy?: "tenant" | "global";
  /** Release the slot(s). Idempotent and safe to call in a `finally`. */
  release: () => Promise<void>;
}

const NOOP_RELEASE = async () => {};

/**
 * Acquire one per-tenant concurrency slot for an import request.
 *
 * Redis sorted set keyed per tenant; each in-flight request is a member scored
 * by a heartbeat timestamp it keeps refreshing via an internal timer. On acquire
 * we first evict members whose last heartbeat is older than SLOT_STALE_SECONDS
 * (a crashed request that stopped refreshing), then add ourselves and count. If
 * that exceeds MAX_CONCURRENT we remove our member and report `acquired:false`.
 *
 * Because a live holder keeps refreshing its score, an import of ANY duration is
 * never mistaken for a crashed holder and evicted — this closes the cap-breach
 * that a single start-time score would allow for long (10k-product) imports.
 *
 * The returned `release()` MUST be called in a `finally`; it stops the heartbeat
 * and removes the member. If the process dies, the heartbeat stops and the stale
 * window reclaims the slot automatically.
 *
 * Fails OPEN on Redis errors.
 */
/**
 * Acquire one concurrency slot on `key`, capped at `limit`. Redis sorted set with
 * heartbeat refresh + stale eviction (a crashed holder's slot is reclaimed after
 * SLOT_STALE_SECONDS, so a long import is never mistaken for a crash). Fails OPEN.
 */
async function acquireSlot(
  key: string,
  limit: number
): Promise<{ acquired: boolean; current: number; limit: number; release: () => Promise<void> }> {
  if (limit <= 0) {
    return { acquired: true, current: 0, limit, release: NOOP_RELEASE };
  }
  try {
    const r = getRedis();
    const nowMs = Date.now();
    const member = `${nowMs}-${Math.random().toString(36).slice(2)}`;
    const staleCutoff = nowMs - SLOT_STALE_SECONDS * 1000;

    const pipeline = r.pipeline();
    pipeline.zremrangebyscore(key, 0, staleCutoff); // evict crashed holders first
    pipeline.zadd(key, nowMs, member);
    pipeline.zcard(key);
    pipeline.expire(key, SLOT_KEY_TTL); // whole key self-heals if idle
    const res = await pipeline.exec();
    const current = Number(res?.[2]?.[1] ?? 0);

    if (current > limit) {
      try {
        await r.zrem(key, member);
      } catch {
        /* stale-eviction / TTL will reclaim it */
      }
      return { acquired: false, current, limit, release: NOOP_RELEASE };
    }

    // Heartbeat: refresh our score so a long-running import is never evicted as
    // if it had crashed. unref()'d so it can't keep the process alive.
    const timer = setInterval(() => {
      let beatRedis;
      try {
        beatRedis = getRedis();
      } catch {
        return;
      }
      const beatNow = Date.now();
      Promise.resolve(beatRedis.zadd(key, beatNow, member)).catch(() => {});
      Promise.resolve(beatRedis.expire(key, SLOT_KEY_TTL)).catch(() => {});
    }, HEARTBEAT_MS);
    if (typeof (timer as any)?.unref === "function") (timer as any).unref();

    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      clearInterval(timer);
      try {
        await getRedis().zrem(key, member);
      } catch (err) {
        // Non-fatal: the stale window reclaims this slot.
        console.error("[pim-import-rate-limit] slot release failed:", (err as Error).message);
      }
    };
    return { acquired: true, current, limit, release };
  } catch (err) {
    console.error("[pim-import-rate-limit] concurrency acquire failed, allowing request:", (err as Error).message);
    return { acquired: true, current: 0, limit, release: NOOP_RELEASE }; // fail open
  }
}

/**
 * Acquire BOTH a per-tenant slot (fairness — a tenant can never exceed its own
 * share, so one tenant's flood can't starve others) AND a global slot (protects
 * the shared DB from N tenants aggregating past what Mongo can take). The per-tenant
 * slot is taken first; if the global ceiling then rejects, the tenant slot is
 * released so we never hold a slot we can't use. release() frees both.
 */
export async function acquireImportSlot(tenantKey: string): Promise<ImportSlot> {
  const tenantSlot = await acquireSlot(`ratelimit:pimimport:${tenantKey}:concurrent`, MAX_CONCURRENT);
  if (!tenantSlot.acquired) {
    return { acquired: false, current: tenantSlot.current, limit: tenantSlot.limit, blockedBy: "tenant", release: NOOP_RELEASE };
  }

  const globalSlot = await acquireSlot(`ratelimit:pimimport:global:concurrent`, MAX_CONCURRENT_GLOBAL);
  if (!globalSlot.acquired) {
    await tenantSlot.release(); // don't hold a tenant slot we can't use
    return { acquired: false, current: globalSlot.current, limit: globalSlot.limit, blockedBy: "global", release: NOOP_RELEASE };
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await Promise.allSettled([tenantSlot.release(), globalSlot.release()]);
  };
  return { acquired: true, current: tenantSlot.current, limit: tenantSlot.limit, release };
}
