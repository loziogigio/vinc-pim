import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/config/project.config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/config/project.config")>();
  return { ...original, isSolrEnabled: vi.fn(() => true), getSolrConfig: vi.fn(() => ({ url: "http://solr", defaultRows: 20, maxRows: 100 })) };
});
vi.mock("@/lib/search/solr-client", () => ({ SolrError: class SolrError extends Error {} }));
vi.mock("@/lib/search/execute-search", () => ({
  executeSearchWithFallback: vi.fn(async () => ({
    response: {
      results: [{
        entity_code: "E1",
        media: [{ url: "a", is_public: true }, { url: "b", is_public: false }],
        dynamic_blocks: [{
          id: "blk1", lang: "it", section: 1, order: 0, columns: 2, is_active: true,
          elements: [
            { id: "e1", kind: "text", text: "pub", is_public: true },
            { id: "e2", kind: "text", text: "secret", is_public: false },
          ],
        }],
      }],
      facet_results: null,
    },
  })),
}));
vi.mock("@/lib/search/response-transformer", () => ({
  enrichFacetResults: vi.fn(async (f) => f),
  enrichProductsWithVariants: vi.fn(async (r) => r),
}));
vi.mock("@/lib/search/response-enricher", () => ({
  enrichSearchResults: vi.fn(async (_db: any, results: any) => results),
  enrichVariantGroupedResults: vi.fn(async (_db: any, results: any) => results),
}));
vi.mock("@/lib/services/tag-pricing.service", () => ({ resolveEffectiveTags: vi.fn(() => []) }));
vi.mock("@/lib/db/connection", () => ({ connectWithModels: vi.fn(async () => ({ Customer: { findOne: () => ({ lean: async () => null }) } })) }));
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(async () => ({ authenticated: true, tenantDb: "vinc-blocks-test" })),
}));

const { POST, GET } = await import("@/app/api/search/search/route");
const HEADERS = { "x-resolved-tenant-db": "vinc-blocks-test", "content-type": "application/json" };
function postReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/search/search", { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
}
const API_KEY_HEADERS = { "x-auth-method": "api-key", "content-type": "application/json" };
function postReqApiKeyAuth(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/search/search", { method: "POST", headers: API_KEY_HEADERS, body: JSON.stringify(body) });
}
function getReq(qs: string) {
  return new NextRequest(`http://localhost/api/search/search?${qs}`, { method: "GET", headers: { "x-resolved-tenant-db": "vinc-blocks-test" } });
}
beforeEach(() => vi.clearAllMocks());

describe("unit: search route strips non-public for guests", () => {
  it("POST guest (no auth): drops is_public:false media + elements", async () => {
    const res = await POST(postReq({ lang: "it", include_dynamic_blocks: true }));
    const json = await res.json();
    const p = json.data.results[0];
    expect(p.media.map((m: any) => m.url)).toEqual(["a"]);
    expect(p.dynamic_blocks[0].elements.map((e: any) => e.id)).toEqual(["e1"]);
  });

  it("POST authenticated:true: keeps everything", async () => {
    const res = await POST(postReq({ lang: "it", include_dynamic_blocks: true, authenticated: true }));
    const json = await res.json();
    const p = json.data.results[0];
    expect(p.media.map((m: any) => m.url)).toEqual(["a", "b"]);
    expect(p.dynamic_blocks[0].elements.map((e: any) => e.id)).toEqual(["e1", "e2"]);
  });

  it("POST with customer_code: treated as authenticated, keeps everything", async () => {
    const res = await POST(postReq({ lang: "it", include_dynamic_blocks: true, customer_code: "C1" }));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(2);
  });

  it("POST tenant-auth via API key (no customer_code/authenticated flag): still stripped for guests", async () => {
    // Presence of the api-key/tenant-auth header must NOT disable the guest strip:
    // tenantDb resolves successfully (verifyAPIKeyFromRequest mocked authenticated:true),
    // but the request body carries no customer_code and no authenticated flag.
    const res = await POST(postReqApiKeyAuth({ lang: "it", include_dynamic_blocks: true }));
    const json = await res.json();
    const p = json.data.results[0];
    expect(p.media.map((m: any) => m.url)).toEqual(["a"]);
    expect(p.dynamic_blocks[0].elements.map((e: any) => e.id)).toEqual(["e1"]);
  });

  it("GET guest: drops is_public:false", async () => {
    const res = await GET(getReq("lang=it&include_dynamic_blocks=true"));
    const json = await res.json();
    expect(json.data.results[0].media.map((m: any) => m.url)).toEqual(["a"]);
  });

  it("GET authenticated=true: keeps everything", async () => {
    const res = await GET(getReq("lang=it&include_dynamic_blocks=true&authenticated=true"));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(2);
  });
});
