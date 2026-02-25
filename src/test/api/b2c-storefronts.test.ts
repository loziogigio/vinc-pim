/**
 * B2C Storefronts API Integration Tests
 *
 * Tests for storefront CRUD, branding/header/footer configuration,
 * and public home API with domain-based lookup.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createParams,
  B2CStorefrontFactory,
} from "../conftest";
import { B2CStorefrontSchema } from "@/lib/db/models/b2c-storefront";

// Create test model from schema
const B2CStorefrontModel =
  mongoose.models.B2CStorefront ||
  mongoose.model("B2CStorefront", B2CStorefrontSchema);

// ============================================
// MOCKS — must be before route imports
// ============================================

// Mock auth — initializeB2BRoute returns tenant info
vi.mock("@/lib/auth/b2b-helpers", () => ({
  initializeB2BRoute: vi.fn(() =>
    Promise.resolve({
      session: { isLoggedIn: true, userId: "test-user", tenantId: "test-tenant" },
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

// Mock connection — return our test model
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({ B2CStorefront: B2CStorefrontModel })
  ),
}));

// Mock home template functions
vi.mock("@/lib/db/b2c-home-templates", () => ({
  initB2CHomeTemplate: vi.fn(() => Promise.resolve()),
  deleteB2CHomeTemplates: vi.fn(() => Promise.resolve()),
  getPublishedB2CHomeTemplate: vi.fn(() =>
    Promise.resolve({
      blocks: [{ id: "hero-1", type: "hero", order: 0, config: {} }],
      seo: { title: "Home", description: "Welcome" },
    })
  ),
}));

// Mock API key auth for public API tests
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      valid: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

// ============================================
// ROUTE IMPORTS — after mocks
// ============================================

import {
  GET as listStorefronts,
  POST as createStorefrontRoute,
} from "@/app/api/b2b/b2c/storefronts/route";
import {
  GET as getStorefront,
  PATCH as updateStorefront,
  DELETE as deleteStorefront,
} from "@/app/api/b2b/b2c/storefronts/[slug]/route";
import { GET as getPublicHome } from "@/app/api/b2b/b2c/public/home/route";

// ============================================
// HELPERS
// ============================================

function makeReq(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
) {
  const { method = "GET", body, headers = {} } = options || {};
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });
}

/** Create a storefront directly in DB via route handler */
async function createViaAPI(payload: Record<string, unknown>) {
  const req = makeReq("/api/b2b/b2c/storefronts", {
    method: "POST",
    body: payload,
  });
  const res = await createStorefrontRoute(req);
  return res.json();
}

// ============================================
// TESTS
// ============================================

describe("integration: B2C Storefronts API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  // ============================================
  // POST /api/b2b/b2c/storefronts — Create
  // ============================================

  describe("POST /api/b2b/b2c/storefronts", () => {
    it("should create storefront with valid payload (201)", async () => {
      const payload = B2CStorefrontFactory.createPayload();
      const req = makeReq("/api/b2b/b2c/storefronts", {
        method: "POST",
        body: payload,
      });

      const res = await createStorefrontRoute(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(payload.name);
      expect(data.data.slug).toBe(payload.slug);
      expect(data.data.status).toBe("active");
    });

    it("should reject missing name (400)", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts", {
        method: "POST",
        body: { slug: "no-name" },
      });

      const res = await createStorefrontRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("should reject missing slug (400)", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts", {
        method: "POST",
        body: { name: "No Slug" },
      });

      const res = await createStorefrontRoute(req);

      expect(res.status).toBe(400);
    });

    it("should reject invalid slug format (400)", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts", {
        method: "POST",
        body: { name: "Bad Slug", slug: "Has Spaces!" },
      });

      const res = await createStorefrontRoute(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("lowercase");
    });

    it("should reject duplicate slug (409)", async () => {
      await createViaAPI({ name: "First", slug: "dup-slug", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts", {
        method: "POST",
        body: { name: "Second", slug: "dup-slug" },
      });

      const res = await createStorefrontRoute(req);

      expect(res.status).toBe(409);
    });
  });

  // ============================================
  // GET /api/b2b/b2c/storefronts — List
  // ============================================

  describe("GET /api/b2b/b2c/storefronts", () => {
    it("should return paginated storefronts", async () => {
      await createViaAPI({ name: "Store A", slug: "store-a", domains: [] });
      await createViaAPI({ name: "Store B", slug: "store-b", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts?page=1&limit=10");
      const res = await listStorefronts(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it("should filter by search", async () => {
      await createViaAPI({ name: "Alpha Store", slug: "alpha", domains: [] });
      await createViaAPI({ name: "Beta Store", slug: "beta", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts?search=Alpha");
      const res = await listStorefronts(req);
      const data = await res.json();

      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Alpha Store");
    });
  });

  // ============================================
  // GET /api/b2b/b2c/storefronts/[slug] — Get
  // ============================================

  describe("GET /api/b2b/b2c/storefronts/[slug]", () => {
    it("should return storefront with branding/header/footer", async () => {
      // Create via API, then update with branding via PATCH
      await createViaAPI({ name: "Full Store", slug: "full-store", domains: [] });

      const patchReq = makeReq("/api/b2b/b2c/storefronts/full-store", {
        method: "PATCH",
        body: {
          branding: {
            title: "My Brand",
            primary_color: "#009688",
            logo_url: "https://example.com/logo.svg",
          },
          header: {
            announcement_enabled: true,
            announcement_text: "Welcome!",
            nav_links: [{ label: "Home", href: "/" }],
          },
          footer: {
            copyright_text: "© 2026 Test",
            social_links: [{ platform: "instagram", url: "https://ig.com/test" }],
          },
        },
      });
      await updateStorefront(patchReq, createParams({ slug: "full-store" }));

      // Now GET
      const req = makeReq("/api/b2b/b2c/storefronts/full-store");
      const res = await getStorefront(req, createParams({ slug: "full-store" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.branding.title).toBe("My Brand");
      expect(data.data.branding.primary_color).toBe("#009688");
      expect(data.data.header.announcement_text).toBe("Welcome!");
      expect(data.data.header.nav_links).toHaveLength(1);
      expect(data.data.footer.copyright_text).toBe("© 2026 Test");
      expect(data.data.footer.social_links).toHaveLength(1);
    });

    it("should return 404 for unknown slug", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts/nonexistent");
      const res = await getStorefront(req, createParams({ slug: "nonexistent" }));

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // PATCH /api/b2b/b2c/storefronts/[slug] — Update
  // ============================================

  describe("PATCH /api/b2b/b2c/storefronts/[slug]", () => {
    it("should update branding", async () => {
      await createViaAPI({ name: "Patch Test", slug: "patch-brand", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts/patch-brand", {
        method: "PATCH",
        body: {
          branding: {
            title: "Updated Title",
            logo_url: "https://example.com/new-logo.png",
            font_family: "Roboto",
          },
        },
      });

      const res = await updateStorefront(req, createParams({ slug: "patch-brand" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.branding.title).toBe("Updated Title");
      expect(data.data.branding.logo_url).toBe("https://example.com/new-logo.png");
      expect(data.data.branding.font_family).toBe("Roboto");
    });

    it("should update header nav links", async () => {
      await createViaAPI({ name: "Nav Test", slug: "patch-nav", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts/patch-nav", {
        method: "PATCH",
        body: {
          header: {
            nav_links: [
              { label: "Products", href: "/products" },
              { label: "Blog", href: "/blog", open_in_new_tab: true },
            ],
            show_search: false,
          },
        },
      });

      const res = await updateStorefront(req, createParams({ slug: "patch-nav" }));
      const data = await res.json();

      expect(data.data.header.nav_links).toHaveLength(2);
      expect(data.data.header.nav_links[1].open_in_new_tab).toBe(true);
      expect(data.data.header.show_search).toBe(false);
    });

    it("should update footer columns and social links", async () => {
      await createViaAPI({ name: "Footer Test", slug: "patch-footer", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts/patch-footer", {
        method: "PATCH",
        body: {
          footer: {
            columns: [
              {
                title: "Support",
                links: [
                  { label: "FAQ", href: "/faq" },
                  { label: "Contact", href: "/contact" },
                ],
              },
            ],
            social_links: [
              { platform: "facebook", url: "https://fb.com/test" },
            ],
            bg_color: "#333333",
            text_color: "#eeeeee",
          },
        },
      });

      const res = await updateStorefront(req, createParams({ slug: "patch-footer" }));
      const data = await res.json();

      expect(data.data.footer.columns).toHaveLength(1);
      expect(data.data.footer.columns[0].links).toHaveLength(2);
      expect(data.data.footer.social_links[0].platform).toBe("facebook");
      expect(data.data.footer.bg_color).toBe("#333333");
    });

    it("should return 404 for unknown slug", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts/ghost", {
        method: "PATCH",
        body: { name: "Ghost" },
      });

      const res = await updateStorefront(req, createParams({ slug: "ghost" }));

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // DELETE /api/b2b/b2c/storefronts/[slug]
  // ============================================

  describe("DELETE /api/b2b/b2c/storefronts/[slug]", () => {
    it("should delete storefront", async () => {
      await createViaAPI({ name: "Delete Me", slug: "delete-me", domains: [] });

      const req = makeReq("/api/b2b/b2c/storefronts/delete-me", {
        method: "DELETE",
      });
      const res = await deleteStorefront(req, createParams({ slug: "delete-me" }));

      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);

      // Verify it's gone
      const getReq = makeReq("/api/b2b/b2c/storefronts/delete-me");
      const getRes = await getStorefront(getReq, createParams({ slug: "delete-me" }));
      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent storefront", async () => {
      const req = makeReq("/api/b2b/b2c/storefronts/nope", {
        method: "DELETE",
      });
      const res = await deleteStorefront(req, createParams({ slug: "nope" }));

      expect(res.status).toBe(404);
    });
  });
});

// ============================================
// PUBLIC HOME API
// ============================================

describe("integration: B2C Public Home API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  describe("GET /api/b2b/b2c/public/home", () => {
    it("should return storefront metadata with branding/header/footer", async () => {
      // Create storefront with full config
      await B2CStorefrontModel.create({
        name: "Public Shop",
        slug: "public-shop",
        domains: ["shop.test.com"],
        status: "active",
        branding: {
          title: "Public Brand",
          logo_url: "https://example.com/logo.svg",
          primary_color: "#009688",
        },
        header: {
          announcement_enabled: true,
          announcement_text: "Welcome!",
          nav_links: [{ label: "Home", href: "/" }],
          show_search: true,
          show_cart: true,
          show_account: true,
        },
        footer: {
          copyright_text: "© 2026 Public Shop",
          social_links: [{ platform: "instagram", url: "https://ig.com/test" }],
        },
      });

      const req = makeReq("/api/b2b/b2c/public/home", {
        headers: {
          origin: "https://shop.test.com",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test_123",
          "x-api-secret": "sk_test_456",
        },
      });

      const res = await getPublicHome(req);
      const data = await res.json();

      expect(res.status).toBe(200);

      // Blocks from mocked getPublishedB2CHomeTemplate
      expect(data.blocks).toHaveLength(1);
      expect(data.seo.title).toBe("Home");

      // Storefront metadata
      expect(data.storefront.name).toBe("Public Shop");
      expect(data.storefront.slug).toBe("public-shop");
      expect(data.storefront.branding.title).toBe("Public Brand");
      expect(data.storefront.branding.primary_color).toBe("#009688");
      expect(data.storefront.header.announcement_text).toBe("Welcome!");
      expect(data.storefront.header.nav_links).toHaveLength(1);
      expect(data.storefront.footer.copyright_text).toBe("© 2026 Public Shop");
      expect(data.storefront.footer.social_links).toHaveLength(1);
    });

    it("should return 400 without Origin header", async () => {
      const req = makeReq("/api/b2b/b2c/public/home", {
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test_123",
          "x-api-secret": "sk_test_456",
        },
      });

      const res = await getPublicHome(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Origin");
    });

    it("should return 404 for unknown domain", async () => {
      const req = makeReq("/api/b2b/b2c/public/home", {
        headers: {
          origin: "https://unknown.example.com",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test_123",
          "x-api-secret": "sk_test_456",
        },
      });

      const res = await getPublicHome(req);

      expect(res.status).toBe(404);
      expect((await res.json()).error).toContain("No storefront found");
    });

    it("should return empty blocks when no template is published", async () => {
      // Create storefront
      await B2CStorefrontModel.create({
        name: "Empty Shop",
        slug: "empty-shop",
        domains: ["empty.test.com"],
        status: "active",
        branding: { title: "Empty" },
        header: {},
        footer: {},
      });

      // Override mock to return null (no published template)
      const { getPublishedB2CHomeTemplate } = await import(
        "@/lib/db/b2c-home-templates"
      );
      vi.mocked(getPublishedB2CHomeTemplate).mockResolvedValueOnce(null);

      const req = makeReq("/api/b2b/b2c/public/home", {
        headers: {
          origin: "https://empty.test.com",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test_123",
          "x-api-secret": "sk_test_456",
        },
      });

      const res = await getPublicHome(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.blocks).toEqual([]);
      expect(data.storefront.name).toBe("Empty Shop");
      expect(data.storefront.branding.title).toBe("Empty");
    });
  });
});
