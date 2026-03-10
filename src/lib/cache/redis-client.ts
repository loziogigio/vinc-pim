/**
 * Shared Redis Client Singleton
 *
 * Provides a lazy-initialized Redis connection for caching, rate limiting,
 * and API usage tracking. Reuses the same REDIS_HOST/REDIS_PORT as BullMQ.
 */

import Redis from "ioredis";
import { connectWithModels } from "@/lib/db/connection";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

let redis: Redis | null = null;

/**
 * Get the shared Redis instance. Lazy-initialized on first call.
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
  }
  return redis;
}

/**
 * Invalidate B2C storefront cache via Redis pub/sub.
 *
 * Publishes comma-separated cache names to `vinc-b2c:cache-invalidate:{slug}`
 * for every active storefront in the tenant. The B2C Nitro plugin listens on
 * this channel, clears matching cache entries, and re-warms the routes.
 *
 * Known cache names (see B2C redis-cache-invalidation.ts REWARM_MAP):
 *   - "menu"             → /api/menu?location=header|mobile|footer
 *   - "category-landing" → /api/category-landing, /api/category-landing?flat=true
 *   - "home-config"      → /api/home-config
 *   - "site-config"      → /api/site-config
 */
export async function invalidateB2CCache(
  tenantDb: string,
  cacheNames: string | string[]
): Promise<void> {
  const names = Array.isArray(cacheNames) ? cacheNames.join(",") : cacheNames;
  try {
    const { B2CStorefront } = await connectWithModels(tenantDb);
    const storefronts = await B2CStorefront.find({ status: "active" })
      .select("slug")
      .lean() as Array<{ slug: string }>;

    const r = getRedis();
    for (const sf of storefronts) {
      await r.publish(`vinc-b2c:cache-invalidate:${sf.slug}`, names);
    }

    if (storefronts.length) {
      console.log(
        `[b2c-cache] Invalidated "${names}" for ${storefronts.length} storefront(s)`
      );
    }
  } catch (err) {
    console.warn("[b2c-cache] Failed to invalidate:", (err as Error).message);
  }
}
