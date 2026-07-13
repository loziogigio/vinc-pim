/**
 * Cheap host → tenant_id resolver with Redis cache.
 *
 * Used by the global middleware to bucket per-IP rate limits by tenant. The
 * full auth path (`getTenantFromRequest`) is too heavy to run on every request;
 * this helper only checks the Host header against the tenants registry.
 */

import { getRedis } from "@/lib/cache/redis-client";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import {
  hostCandidatesFromRequest,
  type RequestLike,
} from "@/lib/tenant/request-host";

const HOST_CACHE_TTL = 300; // 5 minutes
const NEGATIVE_CACHE_TTL = 60; // shorter — unknown hosts may get registered later
const CACHE_KEY_PREFIX = "tenant:by-host:";
const NEGATIVE_SENTINEL = "__none__";

export async function resolveTenantIdByHost(
  req: RequestLike,
): Promise<string | null> {
  const hosts = hostCandidatesFromRequest(req);
  if (hosts.length === 0) return null;

  const r = getRedis();
  for (const host of hosts) {
    const cacheKey = `${CACHE_KEY_PREFIX}${host}`;
    const cached = await r.get(cacheKey);
    if (cached !== null && cached !== NEGATIVE_SENTINEL) return cached;

    try {
      const Tenant = await getTenantModel();
      const tenant = await Tenant.findByDomain(host);
      const tenantId = tenant?.tenant_id ?? null;
      await r.setex(
        cacheKey,
        tenantId ? HOST_CACHE_TTL : NEGATIVE_CACHE_TTL,
        tenantId ?? NEGATIVE_SENTINEL,
      );
      if (tenantId) return tenantId;
    } catch (err) {
      console.warn("[host-resolver] lookup failed", { host, err: String(err) });
      return null;
    }
  }

  return null;
}

/**
 * Invalidate the cached host → tenant_id mapping. Call after tenant domain
 * changes (add/remove/update).
 */
export async function invalidateHostCache(host: string): Promise<void> {
  const r = getRedis();
  await r.del(`${CACHE_KEY_PREFIX}${host.toLowerCase()}`);
}
