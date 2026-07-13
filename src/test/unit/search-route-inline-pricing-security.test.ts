import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  customer: null as any,
  effectiveTags: [] as string[],
  results: [] as any[],
  livePortalUser: null as any,
  portalUserFindOne: vi.fn(),
  customerFindOne: vi.fn(),
  tokenPayload: null as any,
  ssoSession: null as any,
  resolveEffectiveTags: vi.fn(),
  loadUserExclusionsForSearch: vi.fn(),
}));

vi.mock("@/config/project.config", () => ({
  isSolrEnabled: vi.fn(() => true),
  getSolrConfig: vi.fn(() => ({
    url: "http://solr",
    defaultRows: 20,
    maxRows: 100,
  })),
}));

vi.mock("@/lib/search/solr-client", () => ({
  SolrError: class SolrError extends Error {},
}));

function productFixture() {
  return {
    entity_code: "SKU-1",
    pricing: { list: 100, list_unit: 100 },
    promotions: [
      { promo_code: "PUBLIC", promo_price: 95 },
      { promo_code: "VIP-PROMO", promo_price: 75, tag_filter: ["vip"] },
    ],
    packaging_options: [
      {
        packaging_code: "STD",
        qty: 1,
        is_default: false,
        pricing: { list: 100 },
      },
      {
        packaging_code: "VIP",
        qty: 1,
        is_default: true,
        pricing: { list: 80, tag_filter: ["vip"] },
      },
    ],
  };
}

vi.mock("@/lib/search/execute-search", () => ({
  executeSearchWithFallback: vi.fn(async () => ({
    response: { results: mocks.results, facet_results: null },
  })),
}));

vi.mock("@/lib/search/response-transformer", () => ({
  enrichFacetResults: vi.fn(async (facets) => facets),
  enrichProductsWithVariants: vi.fn(async (results) => results),
}));

vi.mock("@/lib/search/response-enricher", () => ({
  enrichSearchResults: vi.fn(async (_db, results) => results),
  enrichVariantGroupedResults: vi.fn(async (_db, results) => results),
}));

vi.mock("@/app/api/search/search/exclusions-loader", () => ({
  loadUserExclusionsForSearch: mocks.loadUserExclusionsForSearch,
}));

vi.mock("@/lib/services/tag-pricing.service", () => ({
  resolveEffectiveTags: mocks.resolveEffectiveTags,
}));

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    PortalUser: {
      findOne: (...args: any[]) => ({
        lean: async () => mocks.portalUserFindOne(...args),
      }),
    },
    Customer: {
      findOne: (...args: any[]) => ({
        lean: async () => mocks.customerFindOne(...args),
      }),
    },
  })),
}));

vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(async () => ({
    authenticated: true,
    tenantId: "inline-security",
    tenantDb: "vinc-inline-security",
  })),
}));

vi.mock("@/lib/sso/tokens", () => ({
  validateAccessToken: vi.fn(async (token: string) =>
    token === "valid-token" ? mocks.tokenPayload : null,
  ),
}));

vi.mock("@/lib/sso/session", () => ({
  getSession: vi.fn(async (sessionId: string) =>
    sessionId === "session-1" ? mocks.ssoSession : null,
  ),
}));

const { POST, GET } = await import("@/app/api/search/search/route");

const GUEST_HEADERS = {
  "content-type": "application/json",
  "x-resolved-tenant-db": "vinc-inline-security",
};

const TRUSTED_HEADERS = {
  "content-type": "application/json",
  "x-auth-method": "api-key",
  authorization: "Bearer valid-token",
  "x-user-id": "user-1",
  "x-user-type": "b2b_user",
};

function post(body: Record<string, unknown>, trusted = false) {
  return new NextRequest("http://localhost/api/search/search", {
    method: "POST",
    headers: trusted ? TRUSTED_HEADERS : GUEST_HEADERS,
    body: JSON.stringify({ lang: "it", channel: "b2b", ...body }),
  });
}

beforeEach(() => {
  mocks.customer = null;
  mocks.effectiveTags = [];
  mocks.results = [productFixture()];
  mocks.livePortalUser = {
    customer_access: [{
      customer_id: "customer-1",
      address_access: ["address-1"],
    }],
  };
  mocks.tokenPayload = {
    sub: "user-1",
    tenant_id: "inline-security",
    session_id: "session-1",
  };
  mocks.ssoSession = {
    tenant_id: "inline-security",
    user_id: "user-1",
    vinc_profile: {
      customers: [
        {
          id: "customer-1",
          erp_customer_id: "CUST-1",
          addresses: [
            { id: "address-1", erp_address_id: "ADDR-1" },
            { id: "address-2", erp_address_id: "ADDR-2" },
          ],
        },
      ],
    },
  };
  mocks.portalUserFindOne.mockReset();
  mocks.portalUserFindOne.mockImplementation(() => mocks.livePortalUser);
  mocks.customerFindOne.mockReset();
  mocks.customerFindOne.mockImplementation(() => mocks.customer);
  mocks.resolveEffectiveTags.mockReset();
  mocks.resolveEffectiveTags.mockImplementation(() => mocks.effectiveTags);
  mocks.loadUserExclusionsForSearch.mockReset();
  mocks.loadUserExclusionsForSearch.mockResolvedValue([]);
});

describe("search inline pricing context security", () => {
  it("treats an empty explicit POST tag filter as guest context", async () => {
    const response = await POST(post({ tag_filter: [] }));
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toBeUndefined();
  });

  it("filters tagged tiers when a valid customer resolves to no tags", async () => {
    mocks.customer = {
      tags: [],
      addresses: [{ external_code: "ADDR-1" }],
    };
    mocks.effectiveTags = [];

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(
      json.data.results[0].packaging_options.map(
        (option: any) => option.packaging_code,
      ),
    ).toEqual(["STD"]);
    expect(json.data.results[0].pricing.list).toBe(100);
    expect(
      json.data.results[0].promotions.map((promotion: any) =>
        promotion.promo_code
      ),
    ).toEqual(["PUBLIC"]);
    expect(json.data.results[0].promo_code).toEqual(["PUBLIC"]);
    expect(json.data.results[0].has_active_promo).toBe(true);
  });

  it("rejects a customer address that is absent from the SSO profile", async () => {
    mocks.customer = {
      tags: ["vip"],
      addresses: [{ external_code: "ADDR-1" }],
    };

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "FOREIGN-ADDRESS" }, true),
    );
    expect(response.status).toBe(403);
    expect(mocks.resolveEffectiveTags).not.toHaveBeenCalled();
  });

  it("applies live address restrictions to a previously overbroad session profile", async () => {
    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-2" }, true),
    );

    expect(response.status).toBe(403);
    expect(mocks.resolveEffectiveTags).not.toHaveBeenCalled();
  });

  it("downgrades a deactivated or deleted live portal user to guest context", async () => {
    mocks.livePortalUser = null;

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(mocks.resolveEffectiveTags).not.toHaveBeenCalled();
    expect(mocks.portalUserFindOne).toHaveBeenCalledWith(
      {
        portal_user_id: "user-1",
        tenant_id: "inline-security",
        is_active: true,
      },
      { customer_access: 1 },
    );
  });

  it("does not accept a bearer issued for another tenant", async () => {
    mocks.tokenPayload = {
      ...mocks.tokenPayload,
      tenant_id: "other-tenant",
    };

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(mocks.portalUserFindOne).not.toHaveBeenCalled();
  });

  it("does not accept a bearer whose SSO session was revoked", async () => {
    mocks.ssoSession = null;

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(mocks.portalUserFindOne).not.toHaveBeenCalled();
  });

  it("keeps only matching and untagged tiers for an owned pair", async () => {
    mocks.customer = {
      tags: ["vip"],
      addresses: [{ external_code: "ADDR-1" }],
    };
    mocks.effectiveTags = ["vip"];

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(
      json.data.results[0].packaging_options.map(
        (option: any) => option.packaging_code,
      ),
    ).toEqual(["STD", "VIP"]);
    expect(json.data.results[0].pricing.list).toBe(80);
    expect(
      json.data.results[0].promotions.map((promotion: any) =>
        promotion.promo_code
      ),
    ).toEqual(["PUBLIC", "VIP-PROMO"]);
  });

  it("resolves authorized fallback customer/address IDs without ERP codes", async () => {
    mocks.customer = {
      customer_id: "CUST-1",
      tags: [],
      addresses: [{ address_id: "ADDR-1" }],
    };

    const response = await POST(
      post({ customer_code: "CUST-1", address_code: "ADDR-1" }, true),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.results[0].packaging_options).toHaveLength(1);
    expect(mocks.customerFindOne).toHaveBeenCalledWith(
      {
        $or: [
          { external_code: "CUST-1" },
          { customer_id: "CUST-1" },
        ],
      },
      { tags: 1, addresses: 1 },
    );
  });

  it("treats an empty GET tag filter as guest context", async () => {
    const request = new NextRequest(
      "http://localhost/api/search/search?lang=it&channel=b2b&tag_filter=,,,%20",
      { headers: { "x-resolved-tenant-db": "vinc-inline-security" } },
    );

    const response = await GET(request);
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toBeUndefined();
  });

  it("ignores a caller-supplied non-empty tag filter without user authorization", async () => {
    const response = await POST(post({ tag_filter: ["vip"] }));
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(json.data.results[0].pricing.list).toBe(100);
    expect(
      json.data.results[0].promotions.map((promotion: any) =>
        promotion.promo_code
      ),
    ).toEqual(["PUBLIC"]);
  });

  it("does not trust API-key user headers without a validated bearer", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/search/search",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-auth-method": "api-key",
          "x-user-id": "user-1",
          "x-user-type": "b2b_user",
        },
        body: JSON.stringify({
          lang: "it",
          channel: "b2b",
          customer_code: "CUST-1",
          address_code: "ADDR-1",
          tag_filter: ["vip"],
        }),
      },
    ));
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(mocks.resolveEffectiveTags).not.toHaveBeenCalled();
    expect(mocks.loadUserExclusionsForSearch).toHaveBeenCalledWith(
      "vinc-inline-security",
      "b2b",
      undefined,
      undefined,
    );
  });

  it("removes a tagged top-level price when no authorized tier matches", async () => {
    mocks.results = [{
      entity_code: "TAGGED-ONLY",
      pricing: { list: 80, tag_filter: ["vip"] },
      packaging_options: [{
        packaging_code: "VIP",
        qty: 1,
        is_default: true,
        pricing: { list: 80, tag_filter: ["vip"] },
      }],
    }];
    mocks.customer = {
      tags: [],
      addresses: [{ external_code: "ADDR-1" }],
    };

    const response = await POST(post({
      customer_code: "CUST-1",
      address_code: "ADDR-1",
    }, true));
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toEqual([]);
    expect(json.data.results[0].pricing).toBeUndefined();
    expect(json.data.results[0].has_active_promo).toBe(false);
  });

  it("does not mix fields from a rejected top-level tier into public packaging pricing", async () => {
    mocks.results = [{
      entity_code: "MIXED-PRICE",
      pricing: {
        list: 80,
        sale: 70,
        tag_filter: ["vip"],
      },
      packaging_options: [{
        packaging_code: "PUBLIC",
        qty: 1,
        is_default: true,
        pricing: { list: 100 },
      }],
    }];
    mocks.customer = {
      tags: [],
      addresses: [{ external_code: "ADDR-1" }],
    };

    const response = await POST(post({
      customer_code: "CUST-1",
      address_code: "ADDR-1",
    }, true));
    const json = await response.json();

    expect(json.data.results[0].pricing.list).toBe(100);
    expect(json.data.results[0].pricing.sale).toBeUndefined();
  });

  it("removes tagged top-level pricing from a guest response", async () => {
    mocks.results = [{
      entity_code: "TAGGED-GUEST",
      pricing: { list: 80, tag_filter: ["vip"] },
      packaging_options: [{
        packaging_code: "VIP",
        qty: 1,
        is_default: true,
        pricing: { list: 80, tag_filter: ["vip"] },
      }],
    }];

    const response = await POST(post({}));
    const json = await response.json();

    expect(json.data.results[0].packaging_options).toBeUndefined();
    expect(json.data.results[0].pricing).toBeUndefined();
    expect(json.data.results[0].has_active_promo).toBe(false);
  });

  it("rejects a foreign GET customer selection before searching", async () => {
    const request = new NextRequest(
      "http://localhost/api/search/search?lang=it&channel=b2b&customer_code=FOREIGN&address_code=ADDR-1",
      { headers: TRUSTED_HEADERS },
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
