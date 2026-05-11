/**
 * Tests for public B2B portal pages endpoints:
 *   GET /api/b2b/b2b/public/pages
 *   GET /api/b2b/b2b/public/pages/[pageSlug]
 *
 * These routes use API-key auth (verifyAPIKey) + Origin→portal-domain lookup.
 * The API-key mock is set up before route imports; portal domain matching is
 * driven by real B2BPortal documents seeded into the in-memory database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

// ============================================
// IN-MEMORY DB SETUP
// ============================================

const TEST_TENANT = "pub-pages-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const PORTAL_SLUG = "default";
const PORTAL_DOMAIN = "portal.example.com";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the connection pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Mock build-guard
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock API-key auth — verifyAPIKey returns valid result for the test tenant
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: vi.fn(() =>
    Promise.resolve({
      valid: true,
      tenantId: TEST_TENANT,
    })
  ),
}));

// Import modules AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const { GET: listPagesGET } = await import("@/app/api/b2b/b2b/public/pages/route");
const { GET: pageBySlugGET } = await import("@/app/api/b2b/b2b/public/pages/[pageSlug]/route");

// ============================================
// HELPERS
// ============================================

function buildRequest(
  method: string,
  url: string,
  opts: { origin?: string; apiKeyValid?: boolean } = {}
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  const headers: Record<string, string> = {};

  if (opts.apiKeyValid !== false) {
    headers["x-api-key-id"] = `ak_${TEST_TENANT}_test`;
    headers["x-api-secret"] = "sk_test_secret";
  }
  if (opts.origin) {
    headers["origin"] = opts.origin;
  }

  return new NextRequest(fullUrl, { method, headers });
}

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conn = await mongoose.createConnection(mongod.getUri()).asPromise();
}, 30000);

afterAll(async () => {
  await conn.dropDatabase();
  await conn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { B2BPortal, B2BPage, HomeTemplate } = await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
  await B2BPage.deleteMany({});
  await HomeTemplate.deleteMany({});

  vi.clearAllMocks();

  // Re-apply the API-key auth mock after clearAllMocks
  const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
  vi.mocked(verifyAPIKey).mockResolvedValue({ valid: true, tenantId: TEST_TENANT });

  // Seed a portal with the test domain
  await B2BPortal.create({
    slug: PORTAL_SLUG,
    name: "Test Portal",
    channel: "default",
    status: "active",
    domains: [{ domain: PORTAL_DOMAIN, is_primary: true }],
    branding: { title: "Test Portal" },
  });
}, 10000);

// ============================================
// GET /api/b2b/b2b/public/pages
// ============================================

describe("GET /api/b2b/b2b/public/pages", () => {
  it("returns 401 when API key headers are missing", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
      apiKeyValid: false,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 401 when API key is invalid", async () => {
    const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
    vi.mocked(verifyAPIKey).mockResolvedValue({ valid: false, error: "Invalid key" });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when Origin header is missing", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages");
    const res = await listPagesGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/origin/i);
  });

  it("returns 404 when Origin domain does not match any portal", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: "https://unknown.example.com",
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(404);
  });

  it("returns empty pages array when no active nav pages exist", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages).toEqual([]);
  });

  it("returns only active + show_in_nav pages", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About", status: "active", show_in_nav: true, sort_order: 0 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "hidden", title: "Hidden", status: "active", show_in_nav: false, sort_order: 1 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "inactive", title: "Inactive", status: "inactive", show_in_nav: true, sort_order: 2 });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages).toHaveLength(1);
    expect(body.pages[0].slug).toBe("about");
  });

  it("returns pages with { slug, title, sort_order } shape", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "contact", title: "Contact Us", status: "active", show_in_nav: true, sort_order: 5 });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages[0]).toEqual({ slug: "contact", title: "Contact Us", sort_order: 5 });
  });

  it("sorts pages by sort_order then title", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "zzz", title: "ZZZ Page", status: "active", show_in_nav: true, sort_order: 2 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "aaa", title: "AAA Page", status: "active", show_in_nav: true, sort_order: 2 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "first", title: "First Page", status: "active", show_in_nav: true, sort_order: 0 });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await listPagesGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pages).toHaveLength(3);
    expect(body.pages[0].slug).toBe("first"); // sort_order: 0
    expect(body.pages[1].slug).toBe("aaa");   // sort_order: 2, title "AAA..." comes first alphabetically
    expect(body.pages[2].slug).toBe("zzz");   // sort_order: 2, title "ZZZ..."
  });
});

// ============================================
// GET /api/b2b/b2b/public/pages/[pageSlug]
// ============================================

describe("GET /api/b2b/b2b/public/pages/[pageSlug]", () => {
  const pageCtx = { params: Promise.resolve({ pageSlug: "about" }) };

  it("returns 401 when API key headers are missing", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: `https://${PORTAL_DOMAIN}`,
      apiKeyValid: false,
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is invalid", async () => {
    const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
    vi.mocked(verifyAPIKey).mockResolvedValue({ valid: false, error: "Invalid key" });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(401);
  });

  it("returns 400 when Origin header is missing", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about");
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when Origin domain does not match any portal", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: "https://unknown.example.com",
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(404);
  });

  it("returns 404 when page has no published template", async () => {
    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found|not published/i);
  });

  it("returns published template { blocks, seo, version, publishedAt }", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const now = new Date().toISOString();
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      name: "About",
      version: 1,
      blocks: [{ id: "hero-1", type: "hero", order: 0, config: {} }],
      seo: { title: "About Us" },
      status: "published",
      publishedAt: now,
      isCurrent: true,
      isCurrentPublished: true,
      createdAt: now,
      lastSavedAt: now,
    });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks[0].type).toBe("hero");
    expect(body.seo).toEqual({ title: "About Us" });
    expect(body.version).toBe(1);
    expect(body.publishedAt).toBeDefined();
  });

  it("returns draft template when ?preview=true is set", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const now = new Date().toISOString();
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      name: "About",
      version: 2,
      blocks: [{ id: "text-1", type: "text", order: 0, config: { content: "Draft content" } }],
      seo: { title: "Draft Title" },
      status: "draft",
      isCurrent: true,
      createdAt: now,
      lastSavedAt: now,
    });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about?preview=true", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const previewCtx = { params: Promise.resolve({ pageSlug: "about" }) };
    const res = await pageBySlugGET(req, previewCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blocks).toHaveLength(1);
    expect(body.version).toBe(2);
    // Preview returns status field too
    expect(body.status).toBe("draft");
  });

  it("returns 404 for non-preview when template exists only as draft", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const now = new Date().toISOString();
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      name: "About",
      version: 1,
      blocks: [],
      seo: {},
      status: "draft",
      isCurrent: true,
      createdAt: now,
      lastSavedAt: now,
    });

    const req = buildRequest("GET", "/api/b2b/b2b/public/pages/about", {
      origin: `https://${PORTAL_DOMAIN}`,
    });
    const res = await pageBySlugGET(req, pageCtx);
    expect(res.status).toBe(404);
  });
});
