import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(async () => ({
    success: true,
    tenantId: "tenant-a",
    tenantDb: "vinc-tenant-a",
    userId: "u1",
    authMethod: "session",
  })),
}));

vi.mock("@/lib/search/solr-client", () => ({
  fetchSolrLukeFields: vi.fn(async () => ({ spec_color_s: { type: "strings" } })),
  SolrClient: class SolrClient {},
  SolrError: class SolrError extends Error {},
  getSolrClient: vi.fn(),
}));

const { GET } = await import("@/app/api/search/facet-fields/route");

function makeReq(url = "http://localhost/api/search/facet-fields?lang=it") {
  return new Request(url) as any;
}

describe("GET /api/search/facet-fields", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns merged static + dynamic fields", async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.fields.some((f: any) => f.field === "brand_id")).toBe(true);
    expect(body.fields.some((f: any) => f.field === "spec_color_s")).toBe(true);
  });

  it("degrades to static-only when Solr fails", async () => {
    const solr = await import("@/lib/search/solr-client");
    (solr.fetchSolrLukeFields as any).mockRejectedValueOnce(new Error("down"));
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.degraded).toBe(true);
    expect(body.fields.some((f: any) => f.field === "brand_id")).toBe(true);
    expect(body.fields.some((f: any) => f.field === "spec_color_s")).toBe(false);
  });

  it("returns 401 when auth fails", async () => {
    const auth = await import("@/lib/auth/tenant-auth");
    (auth.requireTenantAuth as any).mockResolvedValueOnce({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });
});
