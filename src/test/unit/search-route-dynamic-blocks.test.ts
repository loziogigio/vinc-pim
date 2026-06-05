import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/config/project.config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/config/project.config")>();
  return { ...original, isSolrEnabled: vi.fn(() => true), getSolrConfig: vi.fn(() => ({ url: "http://solr", defaultRows: 20, maxRows: 100 })) };
});
vi.mock("@/lib/search/solr-client", () => ({
  SolrError: class SolrError extends Error {},
  SolrClient: class SolrClient {
    search = vi.fn(async () => ({ response: { numFound: 1, start: 0, docs: [] } }));
  },
}));
vi.mock("@/lib/search/query-builder", () => ({ buildSearchQuery: vi.fn(() => ({})) }));
vi.mock("@/lib/search/response-transformer", () => ({
  transformSearchResponse: vi.fn(() => ({ results: [{ entity_code: "E1" }], numFound: 1, start: 0 })),
  enrichFacetResults: vi.fn(async (f) => f),
  enrichProductsWithVariants: vi.fn(async (r) => r),
}));
vi.mock("@/lib/services/tag-pricing.service", () => ({ resolveEffectiveTags: vi.fn(() => []) }));
const enrichSearchResults = vi.fn(async (_db: any, results: any) => results);
const enrichVariantGroupedResults = vi.fn(async (_db: any, results: any) => results);
vi.mock("@/lib/search/response-enricher", () => ({
  enrichSearchResults: (...a: any[]) => enrichSearchResults(...a),
  enrichVariantGroupedResults: (...a: any[]) => enrichVariantGroupedResults(...a),
}));
vi.mock("@/lib/db/connection", () => ({ connectWithModels: vi.fn(async () => ({ Customer: { findOne: () => ({ lean: async () => null }) } })) }));

const { POST, GET } = await import("@/app/api/search/search/route");
const HEADERS = { "x-resolved-tenant-db": "vinc-blocks-test", "content-type": "application/json" };
function postReq(body: Record<string, unknown>) { return new NextRequest("http://localhost/api/search/search", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }); }
function getReq(qs: string) { return new NextRequest(`http://localhost/api/search/search?${qs}`, { method: "GET", headers: { "x-resolved-tenant-db": "vinc-blocks-test" } }); }
beforeEach(() => { enrichSearchResults.mockClear(); enrichVariantGroupedResults.mockClear(); });

describe("unit: search route threads include_dynamic_blocks", () => {
  it("POST standard: forwards options.include_dynamic_blocks=true", async () => {
    await POST(postReq({ lang: "it", include_dynamic_blocks: true }));
    expect(enrichSearchResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: true });
  });
  it("POST default: omitted flag forwards false", async () => {
    await POST(postReq({ lang: "it" }));
    expect(enrichSearchResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: false });
  });
  it("POST grouped: forwards options to the variant enricher", async () => {
    await POST(postReq({ lang: "it", group_variants: true, include_dynamic_blocks: true }));
    expect(enrichVariantGroupedResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: true });
  });
  it("GET standard: include_dynamic_blocks=true forwards true", async () => {
    await GET(getReq("lang=it&include_dynamic_blocks=true"));
    expect(enrichSearchResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: true });
  });
  it("GET default: absent param forwards false", async () => {
    await GET(getReq("lang=it"));
    expect(enrichSearchResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: false });
  });
  it("GET grouped: forwards options to the variant enricher", async () => {
    await GET(getReq("lang=it&group_variants=true&include_dynamic_blocks=true"));
    expect(enrichVariantGroupedResults.mock.calls[0][4]).toEqual({ include_dynamic_blocks: true });
  });
});
