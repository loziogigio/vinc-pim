import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BPage + HomeTemplate
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "api-pages-template-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const PORTAL_SLUG = "default";
const PAGE_SLUG = "about";

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

// Mock Redis — we don't want real connections in tests
const mockRedisPublish = vi.fn().mockResolvedValue(1);
vi.mock("@/lib/cache/redis-client", () => ({
  getRedis: vi.fn(() => ({
    publish: mockRedisPublish,
  })),
}));

// Import modules AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const { GET: getTemplateRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/route"
);
const { POST: saveDraftRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/save-draft/route"
);
const { POST: publishRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/publish/route"
);
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, pageSlug: PAGE_SLUG }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-pages-tpl-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed tenant record
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Pages Template Test Tenant",
    status: "active",
    admin_email: "pages-tpl@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });

  // Ensure indexes are built before running tests
  const { HomeTemplate } = await connectWithModels(TEST_DB);
  await HomeTemplate.init();
}, 30000);

afterAll(async () => {
  await tenantConn.dropDatabase();
  await adminConn.dropDatabase();
  await tenantConn.close();
  await adminConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { HomeTemplate } = await connectWithModels(TEST_DB);
  await HomeTemplate.deleteMany({});
  await clearTenantMigrationFlag(TEST_TENANT);
  mockRedisPublish.mockClear();

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

  // Re-apply Redis mock after clearAllMocks
  const { getRedis } = await import("@/lib/cache/redis-client");
  vi.mocked(getRedis).mockReturnValue({ publish: mockRedisPublish } as any);
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template", () => {
  it("auto-inits and returns config when no template doc exists", async () => {
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template`,
      TEST_TENANT
    );
    const res = await getTemplateRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    // Auto-init creates a draft template
    expect(body.slug).toBe(`b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].status).toBe("draft");
    expect(Array.isArray(body.versions[0].blocks)).toBe(true);

    // Verify the doc was actually created in DB
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const tpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
    }).lean();
    expect(tpl).not.toBeNull();
  });

  it("returns existing template config when doc already exists", async () => {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [{ id: "b1", type: "hero", order: 0, config: {}, metadata: {} }],
      seo: { title: "About SEO" },
      status: "published",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template`,
      TEST_TENANT
    );
    const res = await getTemplateRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.versions[0].status).toBe("published");
    expect(body.versions[0].blocks).toHaveLength(1);
    expect(body.versions[0].seo).toMatchObject({ title: "About SEO" });
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template`,
      TEST_TENANT
    );
    const res = await getTemplateRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/save-draft
// ============================================

describe("POST .../template/save-draft", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/save-draft`,
      TEST_TENANT,
      { blocks: [], seo: {} }
    );
    const res = await saveDraftRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 400 when blocks is not an array", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/save-draft`,
      TEST_TENANT,
      { blocks: "not-an-array" }
    );
    const res = await saveDraftRoute(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("blocks");
  });

  it("saves the draft and returns the refreshed config", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    // Pre-create a template so save-draft updates it
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [],
      status: "published",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const newBlocks = [{ id: "hero-1", type: "hero", order: 0, config: { text: "Hello" }, metadata: {} }];
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/save-draft`,
      TEST_TENANT,
      { blocks: newBlocks, seo: { title: "About SEO" } }
    );
    const res = await saveDraftRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    // Returns PageConfig shape
    expect(body.versions).toBeDefined();
    expect(body.versions[0].status).toBe("draft");
    expect(body.versions[0].blocks).toHaveLength(1);

    // Verify persisted in DB
    const tpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
    }).lean() as any;
    expect(tpl.status).toBe("draft");
    expect(tpl.blocks).toHaveLength(1);
    expect(tpl.lastSavedAt).toBeTruthy();
  });

  it("creates the template doc if it doesn't exist yet", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/save-draft`,
      TEST_TENANT,
      { blocks: [] }
    );
    const res = await saveDraftRoute(req, ctx);
    expect(res.status).toBe(200);

    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const tpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
    }).lean();
    expect(tpl).not.toBeNull();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/save-draft`,
      TEST_TENANT,
      { blocks: [] }
    );
    const res = await saveDraftRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/publish
// ============================================

describe("POST .../template/publish", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    const res = await publishRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("publishes the template and sets status to published", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [{ id: "b1", type: "text", order: 0, config: {}, metadata: {} }],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    const res = await publishRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    // Returns PageConfig shape
    expect(body.versions[0].status).toBe("published");
    expect(body.versions[0].publishedAt).toBeTruthy();
    expect(body.currentPublishedVersion).toBe(1);

    // Verify persisted in DB
    const tpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
    }).lean() as any;
    expect(tpl.status).toBe("published");
    expect(tpl.publishedAt).toBeTruthy();
  });

  it("calls getRedis().publish with correct channel and payload", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    await publishRoute(req, ctx);

    expect(mockRedisPublish).toHaveBeenCalledWith(
      `vinc-b2b:cache-invalidate:${PORTAL_SLUG}`,
      `page-${PAGE_SLUG},site-config`
    );
  });

  it("still returns 200 even if Redis publish fails (non-fatal)", async () => {
    await markTenantMigrated(TEST_TENANT);
    mockRedisPublish.mockRejectedValueOnce(new Error("Redis connection refused"));

    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-${PAGE_SLUG}`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    const res = await publishRoute(req, ctx);
    // Even if Redis fails, publish itself should succeed
    expect(res.status).toBe(200);
  });

  it("returns 500 when no template doc exists (cannot publish)", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    const res = await publishRoute(req, ctx);
    expect(res.status).toBe(500);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/${PAGE_SLUG}/template/publish`,
      TEST_TENANT
    );
    const res = await publishRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});
