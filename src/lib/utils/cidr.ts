/**
 * CIDR matching utility for per-IP rate-limit allowlists.
 *
 * Uses ipaddr.js for correct IPv4 + IPv6 prefix matching.
 */

import ipaddr from "ipaddr.js";

export function isValidCidr(s: string): boolean {
  try {
    ipaddr.parseCIDR(s);
    return true;
  } catch {
    return false;
  }
}

export function matchesAnyCIDR(ip: string, cidrs: string[]): boolean {
  if (ip === "unknown" || !cidrs?.length) return false;

  let parsed;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return false;
  }

  for (const c of cidrs) {
    try {
      const range = ipaddr.parseCIDR(c);
      if (parsed.kind() !== range[0].kind()) continue;
      if (parsed.match(range)) return true;
    } catch {
      // Skip malformed entries; keep scanning the rest of the list.
    }
  }
  return false;
}
