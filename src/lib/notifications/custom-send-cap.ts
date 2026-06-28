import { getRedis } from "@/lib/cache/redis-client";

export interface RateCapResult {
  allowed: boolean;
  /** seconds until the window resets (0 when allowed) */
  retryAfter: number;
}

/**
 * Per-tenant fixed-window send cap for custom notifications. Default 60/min,
 * override with CUSTOM_NOTIFICATION_RATE_PER_MIN. Fails OPEN on Redis errors so a
 * Redis blip never blocks all sends.
 */
export async function enforceCustomSendCap(tenantId: string): Promise<RateCapResult> {
  const limit = Number(process.env.CUSTOM_NOTIFICATION_RATE_PER_MIN) || 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const minute = Math.floor(nowSec / 60);
  const key = `customsend:${tenantId}:${minute}`;
  try {
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count <= limit) return { allowed: true, retryAfter: 0 };
    return { allowed: false, retryAfter: 60 - (nowSec % 60) };
  } catch (err) {
    console.warn("[custom-send-cap] rate check failed, allowing:", err);
    return { allowed: true, retryAfter: 0 };
  }
}
