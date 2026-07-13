import { describe, expect, it } from "vitest";
import {
  hostCandidatesFromRequest,
  hostFromRequest,
} from "@/lib/tenant/request-host";

function request(headers: Record<string, string>, hostname = "fallback.test") {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    nextUrl: { hostname },
  };
}

describe("tenant request host parsing", () => {
  it("keeps a local port as the most-specific tenant candidate", () => {
    const req = request({ "x-forwarded-host": "localhost:3005" });
    expect(hostCandidatesFromRequest(req)).toEqual([
      "localhost:3005",
      "localhost",
    ]);
    expect(hostFromRequest(req)).toBe("localhost");
  });

  it("uses the first forwarded authority and normalizes case", () => {
    const req = request({
      "x-forwarded-host": "Shop.Example.COM, internal-proxy:3000",
    });
    expect(hostCandidatesFromRequest(req)).toEqual(["shop.example.com"]);
  });

  it("falls back to nextUrl.hostname when no host header exists", () => {
    expect(hostCandidatesFromRequest(request({}, "shop.example.com"))).toEqual([
      "shop.example.com",
    ]);
  });
});
