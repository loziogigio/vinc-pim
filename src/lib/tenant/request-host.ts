/**
 * Extract the request hostname (no port) from common headers. Handles the
 * multi-value `x-forwarded-host: a, b` case by taking the first entry.
 * Shared host parser for tenant resolution and the public SEO endpoints.
 */

export interface RequestLike {
  headers: { get(name: string): string | null };
  nextUrl?: { hostname?: string };
}

export function hostFromRequest(req: RequestLike): string | null {
  const explicit =
    req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (explicit) {
    return explicit.split(",")[0].split(":")[0].trim().toLowerCase();
  }
  if (req.nextUrl?.hostname) return req.nextUrl.hostname.toLowerCase();
  return null;
}
