/**
 * Cheap host → tenant_id resolver with Redis cache.
 *
 * Used by the global middleware to bucket per-IP rate limits by tenant. The
 * full auth path (`getTenantFromRequest`) is too heavy to run on every request;
 * this helper only checks the Host header against the tenants registry.
 */

import { getRedis } from "@/lib/cache/redis-client";
import { getTenantModel } from "@/lib/db/models/admin-tenant";

const HOST_CACHE_TTL = 300; // 5 minutes
const NEGATIVE_CACHE_TTL = 60; // shorter — unknown hosts may get registered later
const CACHE_KEY_PREFIX = "tenant:by-host:";
const NEGATIVE_SENTINEL = "__none__";

interface RequestLike {
  headers: { get(name: string): string | null };
  nextUrl?: { hostname?: string };
}

function hostFromRequest(req: RequestLike): string | null {
  const explicit = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (explicit) {
    return explicit.split(":")[0].trim().toLowerCase();
  }
  if (req.nextUrl?.hostname) return req.nextUrl.hostname.toLowerCase();
  return null;
}

export async function resolveTenantIdByHost(req: RequestLike): Promise<string | null> {
  const host = hostFromRequest(req);
  if (!host) return null;

  const r = getRedis();
  const cacheKey = `${CACHE_KEY_PREFIX}${host}`;
  const cached = await r.get(cacheKey);
  if (cached !== null) {
    return cached === NEGATIVE_SENTINEL ? null : cached;
  }

  try {
    const Tenant = await getTenantModel();
    const tenant = await Tenant.findByDomain(host);
    const tenantId = tenant?.tenant_id ?? null;
    await r.setex(
      cacheKey,
      tenantId ? HOST_CACHE_TTL : NEGATIVE_CACHE_TTL,
      tenantId ?? NEGATIVE_SENTINEL
    );
    return tenantId;
  } catch (err) {
    console.warn("[host-resolver] lookup failed", { host, err: String(err) });
    return null;
  }
}

/**
 * Invalidate the cached host → tenant_id mapping. Call after tenant domain
 * changes (add/remove/update).
 */
export async function invalidateHostCache(host: string): Promise<void> {
  const r = getRedis();
  await r.del(`${CACHE_KEY_PREFIX}${host.toLowerCase()}`);
}
