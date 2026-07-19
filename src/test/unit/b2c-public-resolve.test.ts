import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/b2c-storefront.service", () => ({
  getStorefrontBySlug: vi.fn(),
  getStorefrontByDomain: vi.fn(),
}));
import { getStorefrontBySlug, getStorefrontByDomain } from "@/lib/services/b2c-storefront.service";
import { resolvePublicStorefront } from "@/lib/services/b2c-public-resolve";

const DB = "vinc-office";
const req = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(new Request(`http://cs.local${url}`, { headers }));

beforeEach(() => vi.clearAllMocks());

describe("resolvePublicStorefront", () => {
  it("resolves by ?storefront= slug first, no Origin needed", async () => {
    (getStorefrontBySlug as any).mockResolvedValue({ slug: "my-store", status: "active" });
    const r = await resolvePublicStorefront(req("/api/x?storefront=my-store"), DB);
    expect("storefront" in r && r.storefront.slug).toBe("my-store");
    expect(getStorefrontByDomain).not.toHaveBeenCalled();
  });
  it("404s an unknown or inactive slug", async () => {
    (getStorefrontBySlug as any).mockResolvedValue(null);
    const r = await resolvePublicStorefront(req("/api/x?storefront=nope"), DB);
    expect("response" in r && r.response.status).toBe(404);
  });
  it("falls back to Origin-domain resolution when no slug param", async () => {
    (getStorefrontByDomain as any).mockResolvedValue({ slug: "domain-store", status: "active" });
    const r = await resolvePublicStorefront(req("/api/x", { origin: "https://shop.example.com" }), DB);
    expect("storefront" in r && r.storefront.slug).toBe("domain-store");
  });
  it("400s when neither slug nor Origin present", async () => {
    const r = await resolvePublicStorefront(req("/api/x"), DB);
    expect("response" in r && r.response.status).toBe(400);
  });
});
