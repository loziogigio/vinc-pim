/**
 * Tests for public B2B portal endpoints:
 *   GET /api/b2b/b2b/public/home
 *   GET /api/b2b/b2b/public/sitemap-data
 *
 * These routes use API-key auth (verifyAPIKey), NOT requireTenantAuth.
 * The mock for api-key-auth must be set up BEFORE route imports.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { buildPublicRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP
// ============================================

const TEST_TENANT = "public-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the connection pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Mock build-guard (imported transitively by connection-pool)
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
const { GET: homeGET } = await import("@/app/api/b2b/b2b/public/home/route");
const { GET: sitemapDataGET } = await import("@/app/api/b2b/b2b/public/sitemap-data/route");

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
  const { HomeSettings, HomeTemplate, B2BPortal, B2BSitemap } =
    await connectWithModels(TEST_DB);
  await HomeSettings.deleteMany({});
  await HomeTemplate.deleteMany({});
  await B2BPortal.deleteMany({});
  await B2BSitemap.deleteMany({});
  vi.clearAllMocks();
  // Re-apply the API-key auth mock after clearAllMocks
  const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
  vi.mocked(verifyAPIKey).mockResolvedValue({ valid: true, tenantId: TEST_TENANT });
});

// ============================================
// public routes
// ============================================

describe("public routes", () => {
  // ── home ──────────────────────────────────────────────────────────────────

  it("GET /public/home returns 401 when API key headers are missing", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/b2b/b2b/public/home?portal=default", {
      method: "GET",
    });
    const res = await homeGET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("GET /public/home returns synthesized data when unmigrated (HomeSettings fallback)", async () => {
    const { HomeSettings } = await connectWithModels(TEST_DB);
    await HomeSettings.create({
      customerId: TEST_TENANT,
      branding: { title: "Pub" },
      header_config: { rows: [] },
      footer: {},
      meta_tags: {},
      custom_scripts: [],
    });

    const req = buildPublicRequest(
      "GET",
      `/api/b2b/b2b/public/home?portal=default`,
      TEST_TENANT,
    );
    const res = await homeGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portal?.branding?.title).toBe("Pub");
  });

  it("GET /public/home returns migrated portal data when B2BPortal row exists", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({
      slug: "default",
      name: "P",
      channel: "default",
      branding: { title: "Mig" },
    });

    const req = buildPublicRequest(
      "GET",
      `/api/b2b/b2b/public/home?portal=default`,
      TEST_TENANT,
    );
    const res = await homeGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portal?.branding?.title).toBe("Mig");
  });

  it("GET /public/home returns homeTemplate with published blocks when available", async () => {
    const { B2BPortal, HomeTemplate } = await connectWithModels(TEST_DB);
    await B2BPortal.create({
      slug: "default",
      name: "P",
      channel: "default",
      branding: { title: "Mig" },
    });
    const now = new Date().toISOString();
    await HomeTemplate.create({
      portal_slug: "default",
      templateId: "home",
      name: "Home Page",
      version: 1,
      blocks: [{ id: "hero-1", type: "hero", order: 0, config: {} }],
      seo: { title: "Home" },
      status: "published",
      isCurrent: true,
      isCurrentPublished: true,
      isDefault: true,
      createdAt: now,
      lastSavedAt: now,
    });

    const req = buildPublicRequest(
      "GET",
      `/api/b2b/b2b/public/home?portal=default`,
      TEST_TENANT,
    );
    const res = await homeGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.homeTemplate).toBeDefined();
  });

  // ── sitemap-data ──────────────────────────────────────────────────────────

  it("GET /public/sitemap-data returns 401 when API key headers are missing", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      "http://localhost/api/b2b/b2b/public/sitemap-data?portal=default",
      { method: "GET" },
    );
    const res = await sitemapDataGET(req);
    expect(res.status).toBe(401);
  });

  it("GET /public/sitemap-data returns 200 with empty URLs when no sitemap exists", async () => {
    const req = buildPublicRequest(
      "GET",
      `/api/b2b/b2b/public/sitemap-data?portal=default`,
      TEST_TENANT,
    );
    const res = await sitemapDataGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.urls)).toBe(true);
    expect(body.robots_config).toBeDefined();
    expect(body.portal).toBeDefined();
    expect(body.portal.slug).toBe("default");
  });

  it("GET /public/sitemap-data returns sitemap data when a B2BSitemap row exists", async () => {
    const { B2BSitemap } = await connectWithModels(TEST_DB);
    await B2BSitemap.create({
      portal_slug: "default",
      urls: [{ path: "/products/sku-1", type: "product", changefreq: "weekly", priority: 0.8 }],
      robots_config: { custom_rules: "", disallow: ["/admin/"] },
      stats: {
        total_urls: 1,
        page_urls: 0,
        product_urls: 1,
        category_urls: 0,
        homepage_urls: 0,
        locales: ["it"],
        last_generated_at: new Date(),
        generation_duration_ms: 100,
      },
    });

    const req = buildPublicRequest(
      "GET",
      `/api/b2b/b2b/public/sitemap-data?portal=default`,
      TEST_TENANT,
    );
    const res = await sitemapDataGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.urls).toHaveLength(1);
    expect(body.urls[0].path).toBe("/products/sku-1");
    expect(body.stats).toBeDefined();
    expect(body.portal.slug).toBe("default");
  });
});
