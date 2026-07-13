/**
 * Extract the request hostname (no port) from common headers. Handles the
 * multi-value `x-forwarded-host: a, b` case by taking the first entry.
 * Shared host parser for tenant resolution and the public SEO endpoints.
 */

export interface RequestLike {
  headers: { get(name: string): string | null };
  nextUrl?: { hostname?: string };
}

/**
 * Host values to try when resolving a tenant, ordered from most to least
 * specific. Keeping the port as the first candidate matters in local
 * multi-tenant development where `localhost:3005` and `localhost:3006` can be
 * registered to different tenants. Production hostnames normally collapse to
 * a single candidate.
 */
export function hostCandidatesFromRequest(req: RequestLike): string[] {
  const explicit =
    req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (explicit) {
    const authority = explicit.split(",")[0].trim().toLowerCase();
    if (!authority) return [];

    let hostname = authority;
    try {
      hostname = new URL(`http://${authority}`).hostname.toLowerCase();
    } catch {
      // Preserve the previous permissive parsing for malformed proxy headers.
      hostname = authority.split(":")[0].trim().toLowerCase();
    }

    return [...new Set([authority, hostname].filter(Boolean))];
  }

  const hostname = req.nextUrl?.hostname?.toLowerCase();
  return hostname ? [hostname] : [];
}

export function hostFromRequest(req: RequestLike): string | null {
  const candidates = hostCandidatesFromRequest(req);
  return candidates.at(-1) ?? null;
}
