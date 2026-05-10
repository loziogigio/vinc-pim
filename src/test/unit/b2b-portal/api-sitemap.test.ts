import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BSitemap
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "sitemap-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

// Mock connection-pool so connectWithModels uses tenantConn
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => tenantConn),
}));

// Mock build-guard
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock getTenantModel to use adminConn in-memory Tenant model
vi.mock("@/lib/db/models/admin-tenant", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/models/admin-tenant")>();
  return {
    ...original,
    getTenantModel: vi.fn(async () => TenantModel),
  };
});

// Mock requireTenantAuth to always succeed with the test tenant
vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT,
      tenantDb: TEST_DB,
      userId: "test-user",
      authMethod: "session",
    })
  ),
}));

// Import modules AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const { GET, PATCH } = await import("@/app/api/b2b/b2b/portals/[slug]/sitemap/route");
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

const ctx = { params: Promise.resolve({ slug: "default" }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed tenant record so isTenantMigrated can find it
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Sitemap Test Tenant",
    status: "active",
    admin_email: "sitemap@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });
}, 30000);

afterAll(async () => {
  await tenantConn.dropDatabase();
  await adminConn.dropDatabase();
  await tenantConn.close();
  await adminConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { B2BSitemap } = await connectWithModels(TEST_DB);
  await B2BSitemap.deleteMany({});
  await clearTenantMigrationFlag(TEST_TENANT);

  vi.clearAllMocks();

  // Re-apply mocks after clearAllMocks
  const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
  vi.mocked(requireTenantAuth).mockResolvedValue({
    success: true,
    tenantId: TEST_TENANT,
    tenantDb: TEST_DB,
    userId: "test-user",
    authMethod: "session",
  });

  const { getTenantModel } = await import("@/lib/db/models/admin-tenant");
  vi.mocked(getTenantModel).mockResolvedValue(TenantModel);
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/sitemap
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/sitemap", () => {
  it("returns default (empty) sitemap when none exists", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.generated).toBe(false);
    expect(body.data.stats).toBeNull();
    expect(body.data.url_count).toBe(0);
    expect(body.data.robots_config.custom_rules).toBe("");
    expect(Array.isArray(body.data.robots_config.disallow)).toBe(true);
  });

  it("returns sitemap data when a document exists", async () => {
    const { B2BSitemap } = await connectWithModels(TEST_DB);
    await B2BSitemap.create({
      portal_slug: "default",
      urls: [],
      robots_config: { custom_rules: "# custom", disallow: ["/api/"] },
      stats: {
        total_urls: 5,
        page_urls: 3,
        product_urls: 2,
        category_urls: 0,
        homepage_urls: 0,
        locales: ["it"],
        last_generated_at: new Date(),
        generation_duration_ms: 100,
      },
      validation: { warnings: [], errors: [], last_validated_at: new Date() },
    });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.generated).toBe(true);
    expect(body.data.stats.total_urls).toBe(5);
    expect(body.data.robots_config.custom_rules).toBe("# custom");
  });

  it("is portal-scoped — does not return data from another portal", async () => {
    const { B2BSitemap } = await connectWithModels(TEST_DB);
    // Insert sitemap for 'beta' portal only
    await B2BSitemap.create({
      portal_slug: "beta",
      urls: [],
      robots_config: { custom_rules: "", disallow: [] },
      stats: {
        total_urls: 10,
        page_urls: 10,
        product_urls: 0,
        category_urls: 0,
        homepage_urls: 0,
        locales: ["en"],
        last_generated_at: new Date(),
        generation_duration_ms: 50,
      },
      validation: { warnings: [], errors: [], last_validated_at: new Date() },
    });

    // GET for 'default' — should return empty default, not beta's data
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.generated).toBe(false);
    expect(body.data.url_count).toBe(0);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// PATCH /api/b2b/b2b/portals/[slug]/sitemap
// ============================================

describe("PATCH /api/b2b/b2b/portals/[slug]/sitemap", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT, {
      settings: {},
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("writes sitemap settings after migration", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT, {
      settings: { enabled: true },
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("updates robots_config custom_rules after migration", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT, {
      robots_config: { custom_rules: "User-agent: *\nDisallow: /staging/" },
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.robots_config.custom_rules).toBe("User-agent: *\nDisallow: /staging/");
  });

  it("is portal-scoped — PATCH only affects the correct portal", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BSitemap } = await connectWithModels(TEST_DB);

    // Create sitemaps for two portals
    await B2BSitemap.create({
      portal_slug: "default",
      urls: [],
      robots_config: { custom_rules: "original", disallow: [] },
      stats: {},
      validation: {},
    });
    await B2BSitemap.create({
      portal_slug: "beta",
      urls: [],
      robots_config: { custom_rules: "beta-original", disallow: [] },
      stats: {},
      validation: {},
    });

    // PATCH 'default' portal
    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT, {
      robots_config: { custom_rules: "updated" },
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);

    // Verify 'beta' portal was not affected
    const betaSitemap = await B2BSitemap.findOne({ portal_slug: "beta" }).lean() as any;
    expect(betaSitemap.robots_config.custom_rules).toBe("beta-original");
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/sitemap`, TEST_TENANT, {
      settings: {},
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(401);
  });
});
