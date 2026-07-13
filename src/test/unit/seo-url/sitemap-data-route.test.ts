import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant/host-resolver", () => ({
  resolveTenantIdByHost: vi.fn(),
}));
vi.mock("@/lib/services/b2b-sitemap.service", () => ({
  buildB2BSitemapData: vi.fn(),
}));

const { GET } = await import("@/app/api/public/b2b/sitemap-data/route");
const { resolveTenantIdByHost } = await import(
  "@/lib/tenant/host-resolver"
);
const { buildB2BSitemapData } = await import(
  "@/lib/services/b2b-sitemap.service"
);

function request(path = "/api/public/b2b/sitemap-data") {
  return new NextRequest(`https://suite.internal${path}`, {
    headers: { "x-forwarded-host": "shop.example.com" },
  });
}

describe("GET /api/public/b2b/sitemap-data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the authoritative portal sitemap", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(buildB2BSitemapData).mockResolvedValue({
      baseUrl: "https://shop.example.com",
      langs: ["it"],
      entries: [{ loc: "/it", type: "static" }],
    });

    const response = await GET(request("/api/public/b2b/sitemap-data?portal=trade"));

    expect(response.status).toBe(200);
    expect(buildB2BSitemapData).toHaveBeenCalledWith(
      "vinc-tenant-a",
      "shop.example.com",
      "trade",
    );
    expect((await response.json()).entries).toHaveLength(1);
  });

  it("preserves an authoritative empty sitemap for an inactive portal", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(buildB2BSitemapData).mockResolvedValue({
      baseUrl: "https://shop.example.com",
      langs: [],
      entries: [],
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ entries: [] });
  });

  it("returns non-2xx for an unknown host so the storefront may use its fallback", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(buildB2BSitemapData).not.toHaveBeenCalled();
  });

  it("returns non-2xx when authoritative generation is unavailable", async () => {
    vi.mocked(resolveTenantIdByHost).mockResolvedValue("tenant-a");
    vi.mocked(buildB2BSitemapData).mockRejectedValue(new Error("database down"));

    const response = await GET(request());

    expect(response.status).toBe(503);
  });
});
