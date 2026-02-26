/**
 * Shared Redis Client Singleton
 *
 * Provides a lazy-initialized Redis connection for caching, rate limiting,
 * and API usage tracking. Reuses the same REDIS_HOST/REDIS_PORT as BullMQ.
 */

import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

let redis: Redis | null = null;

/**
 * Get the shared Redis instance. Lazy-initialized on first call.
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });
  }
  return redis;
}
