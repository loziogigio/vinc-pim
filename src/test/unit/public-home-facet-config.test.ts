import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: vi.fn(async () => ({ valid: true, tenantId: "tenant-a" })),
}));
vi.mock("@/lib/services/b2b-portal.service", () => ({
  getPortalBySlug: vi.fn(async () => ({
    slug: "default",
    name: "Default",
    facet_config: { entries: [{ field: "brand_id", visible: true }] },
  })),
}));
vi.mock("@/lib/db/home-settings", () => ({
  getHomeSettings: vi.fn(async () => null),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    HomeTemplate: { findOne: () => ({ lean: async () => null }) },
  })),
}));

const { GET } = await import("@/app/api/b2b/b2b/public/home/route");

describe("GET /api/b2b/b2b/public/home", () => {
  it("includes facet_config in the portal payload", async () => {
    const req = new Request(
      "http://localhost/api/b2b/b2b/public/home?portal=default",
      { headers: { "x-api-key-id": "ak_x", "x-api-secret": "sk_y" } },
    ) as any;
    const res = await GET(req);
    const body = await res.json();
    expect(body.portal.facet_config.entries[0].field).toBe("brand_id");
  });
});
