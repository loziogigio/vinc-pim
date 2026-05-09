/**
 * Client IP extraction with explicit edge-proxy trust model.
 *
 * The TRUSTED_EDGE env var declares which proxy chain sits in front of the app
 * so we know which header to trust. Trusting a header without a known proxy is
 * a spoofing risk; defaulting to "traefik" matches the current production setup.
 */

export type TrustedEdge = "cloudflare" | "traefik" | "none";

export function getTrustedEdge(): TrustedEdge {
  const raw = (process.env.TRUSTED_EDGE || "traefik").toLowerCase();
  if (raw === "cloudflare" || raw === "traefik" || raw === "none") return raw;
  return "traefik";
}

export function normalizeIp(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  let s = raw.trim().toLowerCase();
  if (!s) return "unknown";

  if (s.startsWith("::ffff:")) s = s.slice(7);
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(s)) s = s.split(":")[0];

  return s || "unknown";
}

interface HeadersLike {
  get(name: string): string | null;
}

interface RequestLike {
  headers: HeadersLike;
}

export function extractClientIp(req: RequestLike): string {
  const edge = getTrustedEdge();

  if (edge === "cloudflare") {
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return normalizeIp(cf);
  }

  if (edge === "traefik") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return normalizeIp(xff.split(",")[0]);
    const xri = req.headers.get("x-real-ip");
    if (xri) return normalizeIp(xri);
  }

  return "unknown";
}
