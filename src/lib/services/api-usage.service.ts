/**
 * API Usage Tracking Service
 * Tracks API calls per tenant and API key using Redis counters
 */

import { getRedis } from "@/lib/cache/redis-client";

// Key patterns:
// api:usage:{tenant_id}:daily:{YYYY-MM-DD} → total calls today
// api:usage:{tenant_id}:monthly:{YYYY-MM} → total calls this month
// api:usage:{tenant_id}:key:{key_id}:daily:{YYYY-MM-DD} → calls per API key

/**
 * Track an API call (fire-and-forget, non-blocking)
 * @param tenant_id - Tenant identifier
 * @param api_key_id - Optional API key identifier
 */
export async function trackApiCall(tenant_id: string, api_key_id?: string): Promise<void> {
  try {
    const r = getRedis();
    const now = new Date();
    const day = now.toISOString().slice(0, 10);    // YYYY-MM-DD
    const month = now.toISOString().slice(0, 7);   // YYYY-MM

    const pipeline = r.pipeline();

    // Tenant daily/monthly counters
    pipeline.incr(`api:usage:${tenant_id}:daily:${day}`);
    pipeline.expire(`api:usage:${tenant_id}:daily:${day}`, 86400 * 7); // 7 days TTL
    pipeline.incr(`api:usage:${tenant_id}:monthly:${month}`);
    pipeline.expire(`api:usage:${tenant_id}:monthly:${month}`, 86400 * 35); // 35 days TTL

    // Per API key counter (if provided)
    if (api_key_id) {
      pipeline.incr(`api:usage:${tenant_id}:key:${api_key_id}:daily:${day}`);
      pipeline.expire(`api:usage:${tenant_id}:key:${api_key_id}:daily:${day}`, 86400 * 7);
    }

    await pipeline.exec();
  } catch (err) {
    // Silent fail - don't block API request
    console.error('[API Usage] Tracking error:', err);
  }
}

export interface UsageStats {
  today: number;
  this_month: number;
}

/**
 * Get usage statistics for a tenant
 * @param tenant_id - Tenant identifier
 */
export async function getUsageStats(tenant_id: string): Promise<UsageStats> {
  const r = getRedis();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  const [daily_calls, monthly_calls] = await Promise.all([
    r.get(`api:usage:${tenant_id}:daily:${day}`),
    r.get(`api:usage:${tenant_id}:monthly:${month}`),
  ]);

  return {
    today: parseInt(daily_calls || '0'),
    this_month: parseInt(monthly_calls || '0'),
  };
}

/**
 * Get usage for a specific API key
 * @param tenant_id - Tenant identifier
 * @param api_key_id - API key identifier
 */
export async function getApiKeyUsage(tenant_id: string, api_key_id: string): Promise<number> {
  const r = getRedis();
  const day = new Date().toISOString().slice(0, 10);
  const calls = await r.get(`api:usage:${tenant_id}:key:${api_key_id}:daily:${day}`);
  return parseInt(calls || '0');
}
