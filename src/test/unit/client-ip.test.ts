/**
 * Unit tests for client-IP extraction and normalization.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractClientIp, normalizeIp, getTrustedEdge } from "@/lib/utils/client-ip";

const ORIGINAL_TRUSTED_EDGE = process.env.TRUSTED_EDGE;

function makeReq(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

afterEach(() => {
  if (ORIGINAL_TRUSTED_EDGE === undefined) {
    delete process.env.TRUSTED_EDGE;
  } else {
    process.env.TRUSTED_EDGE = ORIGINAL_TRUSTED_EDGE;
  }
});

describe("unit: client-ip - normalizeIp", () => {
  it("strips ::ffff: IPv4-mapped prefix", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });

  it("unwraps bracketed IPv6", () => {
    expect(normalizeIp("[2001:db8::1]")).toBe("2001:db8::1");
  });

  it("strips IPv4 :port suffix", () => {
    expect(normalizeIp("1.2.3.4:5678")).toBe("1.2.3.4");
  });

  it("lowercases", () => {
    expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("returns 'unknown' for empty/whitespace", () => {
    expect(normalizeIp("")).toBe("unknown");
    expect(normalizeIp("   ")).toBe("unknown");
    expect(normalizeIp(null)).toBe("unknown");
    expect(normalizeIp(undefined)).toBe("unknown");
  });

  it("trims whitespace", () => {
    expect(normalizeIp("  1.2.3.4  ")).toBe("1.2.3.4");
  });
});

describe("unit: client-ip - getTrustedEdge", () => {
  beforeEach(() => {
    delete process.env.TRUSTED_EDGE;
  });

  it("defaults to traefik", () => {
    expect(getTrustedEdge()).toBe("traefik");
  });

  it("accepts cloudflare", () => {
    process.env.TRUSTED_EDGE = "cloudflare";
    expect(getTrustedEdge()).toBe("cloudflare");
  });

  it("accepts none", () => {
    process.env.TRUSTED_EDGE = "none";
    expect(getTrustedEdge()).toBe("none");
  });

  it("falls back to traefik on unknown value", () => {
    process.env.TRUSTED_EDGE = "bogus";
    expect(getTrustedEdge()).toBe("traefik");
  });
});

describe("unit: client-ip - extractClientIp (TRUSTED_EDGE=cloudflare)", () => {
  beforeEach(() => {
    process.env.TRUSTED_EDGE = "cloudflare";
  });

  it("uses cf-connecting-ip", () => {
    const req = makeReq({ "cf-connecting-ip": "203.0.113.42" });
    expect(extractClientIp(req)).toBe("203.0.113.42");
  });

  it("returns unknown when cf header missing (request bypassed CF)", () => {
    const req = makeReq({ "x-forwarded-for": "203.0.113.99" });
    expect(extractClientIp(req)).toBe("unknown");
  });
});

describe("unit: client-ip - extractClientIp (TRUSTED_EDGE=traefik)", () => {
  beforeEach(() => {
    process.env.TRUSTED_EDGE = "traefik";
  });

  it("uses leftmost x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.9.9.9" });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeReq({ "x-real-ip": "203.0.113.7" });
    expect(extractClientIp(req)).toBe("203.0.113.7");
  });

  it("returns unknown when no headers present", () => {
    const req = makeReq({});
    expect(extractClientIp(req)).toBe("unknown");
  });
});

describe("unit: client-ip - extractClientIp (TRUSTED_EDGE=none)", () => {
  beforeEach(() => {
    process.env.TRUSTED_EDGE = "none";
  });

  it("ignores all proxy headers and returns unknown", () => {
    const req = makeReq({
      "x-forwarded-for": "1.2.3.4",
      "cf-connecting-ip": "5.6.7.8",
      "x-real-ip": "9.9.9.9",
    });
    expect(extractClientIp(req)).toBe("unknown");
  });
});
