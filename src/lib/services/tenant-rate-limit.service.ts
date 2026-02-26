/**
 * Tenant Rate Limit Service
 *
 * Dynamic per-tenant rate limiting using Redis.
 * Supports multiple limit types:
 * - requests_per_minute: Burst protection (60 second window)
 * - requests_per_day: Daily quota (24 hour window, resets at midnight UTC)
 * - max_concurrent: Maximum simultaneous connections
 *
 * If no limit is configured for a tenant, requests are not limited.
 */

import { getRedis } from "@/lib/cache/redis-client";

// Cache TTL for tenant settings (5 minutes)
const SETTINGS_CACHE_TTL = 300;

// Time windows
const MINUTE_WINDOW = 60;
const DAY_SECONDS = 86400;

export interface TenantRateLimitSettings {
  enabled: boolean;
  requests_per_minute: number; // 0 = unlimited
  requests_per_day: number; // 0 = unlimited
  max_concurrent: number; // 0 = unlimited
}

export interface RateLimitResult {
  allowed: boolean;
  blocked_by?: "minute" | "day" | "concurrent";
  limits: {
    minute: { current: number; limit: number; remaining: number; reset_at: number };
    day: { current: number; limit: number; remaining: number; reset_at: number };
    concurrent: { current: number; limit: number };
  };
}

/**
 * Cache tenant rate limit settings in Redis
 */
export async function cacheTenantRateLimit(
  tenant_id: string,
  settings: TenantRateLimitSettings
): Promise<void> {
  const r = getRedis();
  const key = `tenant:ratelimit:settings:${tenant_id}`;
  await r.setex(key, SETTINGS_CACHE_TTL, JSON.stringify(settings));
}

/**
 * Get cached tenant rate limit settings
 * Returns null if not cached (caller should fetch from DB and cache)
 */
export async function getCachedTenantRateLimit(
  tenant_id: string
): Promise<TenantRateLimitSettings | null> {
  const r = getRedis();
  const key = `tenant:ratelimit:settings:${tenant_id}`;
  const data = await r.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Invalidate cached rate limit settings for a tenant
 * Call this when tenant settings are updated
 */
export async function invalidateTenantRateLimitCache(
  tenant_id: string
): Promise<void> {
  const r = getRedis();
  await r.del(`tenant:ratelimit:settings:${tenant_id}`);
}

/**
 * Get UTC day key for daily limits (resets at midnight UTC)
 */
function getDayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Get minute window start timestamp
 */
function getMinuteWindow(): { start: number; reset_at: number } {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % MINUTE_WINDOW);
  return { start, reset_at: start + MINUTE_WINDOW };
}

/**
 * Get day window reset timestamp (next midnight UTC)
 */
function getDayResetAt(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor(tomorrow.getTime() / 1000);
}

/**
 * Check and consume rate limit for a tenant
 *
 * @param tenant_id - Tenant identifier
 * @param settings - Rate limit settings (pass null to skip limiting)
 * @param client_key - Client identifier (IP or API key)
 * @returns RateLimitResult with detailed status
 */
export async function checkRateLimit(
  tenant_id: string,
  settings: TenantRateLimitSettings | null,
  client_key: string
): Promise<RateLimitResult> {
  const r = getRedis();
  const now_ms = Date.now();

  // Default result for no limits
  const noLimitResult: RateLimitResult = {
    allowed: true,
    limits: {
      minute: { current: 0, limit: 0, remaining: -1, reset_at: 0 },
      day: { current: 0, limit: 0, remaining: -1, reset_at: 0 },
      concurrent: { current: 0, limit: 0 },
    },
  };

  // No settings or not enabled = no limit
  if (!settings || !settings.enabled) {
    return noLimitResult;
  }

  const { start: minute_start, reset_at: minute_reset } = getMinuteWindow();
  const day_key = getDayKey();
  const day_reset = getDayResetAt();

  // Keys
  const minute_key = `ratelimit:${tenant_id}:minute:${client_key}:${minute_start}`;
  const day_key_full = `ratelimit:${tenant_id}:day:${client_key}:${day_key}`;
  const concurrent_key = `ratelimit:${tenant_id}:concurrent:${client_key}`;

  // Get current values
  const pipeline = r.pipeline();
  pipeline.get(minute_key);
  pipeline.get(day_key_full);
  pipeline.get(concurrent_key);
  const results = await pipeline.exec();

  const minute_current = parseInt((results?.[0]?.[1] as string) || "0");
  const day_current = parseInt((results?.[1]?.[1] as string) || "0");
  const concurrent_current = parseInt((results?.[2]?.[1] as string) || "0");

  // Check limits
  const minute_limit = settings.requests_per_minute;
  const day_limit = settings.requests_per_day;
  const concurrent_limit = settings.max_concurrent;

  // Check minute limit
  if (minute_limit > 0 && minute_current >= minute_limit) {
    return {
      allowed: false,
      blocked_by: "minute",
      limits: {
        minute: { current: minute_current, limit: minute_limit, remaining: 0, reset_at: minute_reset },
        day: { current: day_current, limit: day_limit, remaining: Math.max(0, day_limit - day_current), reset_at: day_reset },
        concurrent: { current: concurrent_current, limit: concurrent_limit },
      },
    };
  }

  // Check day limit
  if (day_limit > 0 && day_current >= day_limit) {
    return {
      allowed: false,
      blocked_by: "day",
      limits: {
        minute: { current: minute_current, limit: minute_limit, remaining: Math.max(0, minute_limit - minute_current), reset_at: minute_reset },
        day: { current: day_current, limit: day_limit, remaining: 0, reset_at: day_reset },
        concurrent: { current: concurrent_current, limit: concurrent_limit },
      },
    };
  }

  // Check concurrent limit
  if (concurrent_limit > 0 && concurrent_current >= concurrent_limit) {
    return {
      allowed: false,
      blocked_by: "concurrent",
      limits: {
        minute: { current: minute_current, limit: minute_limit, remaining: Math.max(0, minute_limit - minute_current), reset_at: minute_reset },
        day: { current: day_current, limit: day_limit, remaining: Math.max(0, day_limit - day_current), reset_at: day_reset },
        concurrent: { current: concurrent_current, limit: concurrent_limit },
      },
    };
  }

  // Increment counters
  const incrPipeline = r.pipeline();

  if (minute_limit > 0) {
    incrPipeline.incr(minute_key);
    incrPipeline.expire(minute_key, MINUTE_WINDOW + 5);
  }

  if (day_limit > 0) {
    incrPipeline.incr(day_key_full);
    incrPipeline.expire(day_key_full, DAY_SECONDS + 3600); // Extra hour buffer
  }

  await incrPipeline.exec();

  return {
    allowed: true,
    limits: {
      minute: {
        current: minute_current + 1,
        limit: minute_limit,
        remaining: minute_limit > 0 ? Math.max(0, minute_limit - minute_current - 1) : -1,
        reset_at: minute_reset,
      },
      day: {
        current: day_current + 1,
        limit: day_limit,
        remaining: day_limit > 0 ? Math.max(0, day_limit - day_current - 1) : -1,
        reset_at: day_reset,
      },
      concurrent: { current: concurrent_current, limit: concurrent_limit },
    },
  };
}

/**
 * Increment concurrent connection counter
 * Call when request starts
 */
export async function incrementConcurrent(tenant_id: string, client_key: string): Promise<number> {
  const r = getRedis();
  const key = `ratelimit:${tenant_id}:concurrent:${client_key}`;
  const count = await r.incr(key);
  // Set expiry as safety (in case decrement fails)
  await r.expire(key, 300); // 5 minutes max
  return count;
}

/**
 * Decrement concurrent connection counter
 * Call when request ends
 */
export async function decrementConcurrent(tenant_id: string, client_key: string): Promise<void> {
  const r = getRedis();
  const key = `ratelimit:${tenant_id}:concurrent:${client_key}`;
  await r.decr(key);
}

/**
 * Get current rate limit status without consuming
 */
export async function getRateLimitStatus(
  tenant_id: string,
  settings: TenantRateLimitSettings | null,
  client_key: string
): Promise<RateLimitResult["limits"]> {
  if (!settings || !settings.enabled) {
    return {
      minute: { current: 0, limit: 0, remaining: -1, reset_at: 0 },
      day: { current: 0, limit: 0, remaining: -1, reset_at: 0 },
      concurrent: { current: 0, limit: 0 },
    };
  }

  const r = getRedis();
  const { start: minute_start, reset_at: minute_reset } = getMinuteWindow();
  const day_key = getDayKey();
  const day_reset = getDayResetAt();

  const minute_key = `ratelimit:${tenant_id}:minute:${client_key}:${minute_start}`;
  const day_key_full = `ratelimit:${tenant_id}:day:${client_key}:${day_key}`;
  const concurrent_key = `ratelimit:${tenant_id}:concurrent:${client_key}`;

  const [minute_val, day_val, concurrent_val] = await Promise.all([
    r.get(minute_key),
    r.get(day_key_full),
    r.get(concurrent_key),
  ]);

  const minute_current = parseInt(minute_val || "0");
  const day_current = parseInt(day_val || "0");
  const concurrent_current = parseInt(concurrent_val || "0");

  return {
    minute: {
      current: minute_current,
      limit: settings.requests_per_minute,
      remaining: settings.requests_per_minute > 0 ? Math.max(0, settings.requests_per_minute - minute_current) : -1,
      reset_at: minute_reset,
    },
    day: {
      current: day_current,
      limit: settings.requests_per_day,
      remaining: settings.requests_per_day > 0 ? Math.max(0, settings.requests_per_day - day_current) : -1,
      reset_at: day_reset,
    },
    concurrent: {
      current: concurrent_current,
      limit: settings.max_concurrent,
    },
  };
}
