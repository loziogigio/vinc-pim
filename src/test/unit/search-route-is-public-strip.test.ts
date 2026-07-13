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
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    PortalUser: {
      findOne: () => ({
        lean: async () => ({ customer_access: [] }),
      }),
    },
    Customer: { findOne: () => ({ lean: async () => null }) },
  })),
}));
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(async () => ({
    authenticated: true,
    tenantId: "blocks-test",
    tenantDb: "vinc-blocks-test",
  })),
}));
vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: vi.fn(async (token: string) =>
    token === "valid-token"
      ? {
          sub: "user-1",
          tenant_id: "blocks-test",
          session_id: "session-1",
        }
      : null,
  ),
}));
vi.mock("@/lib/sso/session", () => ({
  getSession: vi.fn(async (sessionId: string) =>
    sessionId === "session-1"
      ? {
          tenant_id: "blocks-test",
          user_id: "user-1",
          vinc_profile: { customers: [] },
        }
      : null,
  ),
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
function postReqTrustedUser(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/search/search", {
    method: "POST",
    headers: {
      ...API_KEY_HEADERS,
      authorization: "Bearer valid-token",
      "x-user-id": "user-1",
      "x-user-type": "b2b_user",
    },
    body: JSON.stringify(body),
  });
}
function getReq(qs: string, trustedUser = false) {
  return new NextRequest(`http://localhost/api/search/search?${qs}`, {
    method: "GET",
    headers: trustedUser
      ? {
          "x-auth-method": "api-key",
          authorization: "Bearer valid-token",
          "x-user-id": "user-1",
          "x-user-type": "b2b_user",
        }
      : { "x-resolved-tenant-db": "vinc-blocks-test" },
  });
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

  it("POST browser authenticated:true hint does not bypass guest visibility", async () => {
    const res = await POST(postReq({ lang: "it", include_dynamic_blocks: true, authenticated: true }));
    const json = await res.json();
    const p = json.data.results[0];
    expect(p.media.map((m: any) => m.url)).toEqual(["a"]);
    expect(p.dynamic_blocks[0].elements.map((e: any) => e.id)).toEqual(["e1"]);
  });

  it("POST customer_code alone does not establish authentication", async () => {
    const res = await POST(postReq({ lang: "it", include_dynamic_blocks: true, customer_code: "C1" }));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(1);
  });

  it("POST validated SSO bearer keeps authenticated-only content", async () => {
    const res = await POST(postReqTrustedUser({ lang: "it", include_dynamic_blocks: true }));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(2);
    expect(json.data.results[0].dynamic_blocks[0].elements).toHaveLength(2);
  });

  it("POST spoofed user headers without a bearer remain guest content", async () => {
    const res = await POST(new NextRequest("http://localhost/api/search/search", {
      method: "POST",
      headers: {
        ...API_KEY_HEADERS,
        "x-user-id": "spoofed-user",
        "x-user-type": "b2b_user",
      },
      body: JSON.stringify({ lang: "it", include_dynamic_blocks: true }),
    }));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(1);
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

  it("GET authenticated=true hint does not bypass guest visibility", async () => {
    const res = await GET(getReq("lang=it&include_dynamic_blocks=true&authenticated=true"));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(1);
  });

  it("GET validated SSO bearer keeps authenticated-only content", async () => {
    const res = await GET(getReq("lang=it&include_dynamic_blocks=true", true));
    const json = await res.json();
    expect(json.data.results[0].media).toHaveLength(2);
  });
});
