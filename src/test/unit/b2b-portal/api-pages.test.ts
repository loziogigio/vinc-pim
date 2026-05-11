import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BPage + HomeTemplate + B2BFormSubmission
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "api-pages-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const PORTAL_SLUG = "default";

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
const { GET: listPagesRoute, POST: createPageRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/pages/route"
);
const {
  GET: getPageRoute,
  PATCH: updatePageRoute,
  DELETE: deletePageRoute,
} = await import("@/app/api/b2b/b2b/portals/[slug]/pages/[pageSlug]/route");
const { POST: duplicatePageRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/pages/[pageSlug]/duplicate/route"
);
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

const listCtx = { params: Promise.resolve({ slug: PORTAL_SLUG }) };
const pageCtx = { params: Promise.resolve({ slug: PORTAL_SLUG, pageSlug: "about" }) };
const dupCtx = { params: Promise.resolve({ slug: PORTAL_SLUG, pageSlug: "about" }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-pages-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed tenant record
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Pages Test Tenant",
    status: "active",
    admin_email: "pages@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });

  // Ensure indexes are built before running tests
  const { B2BPage, HomeTemplate, B2BFormSubmission } = await connectWithModels(TEST_DB);
  await B2BPage.init();
  await HomeTemplate.init();
  await B2BFormSubmission.init();
}, 30000);

afterAll(async () => {
  await tenantConn.dropDatabase();
  await adminConn.dropDatabase();
  await tenantConn.close();
  await adminConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { B2BPage, HomeTemplate, B2BFormSubmission } = await connectWithModels(TEST_DB);
  await B2BPage.deleteMany({});
  await HomeTemplate.deleteMany({});
  await B2BFormSubmission.deleteMany({});
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
// GET /api/b2b/b2b/portals/[slug]/pages
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/pages", () => {
  it("returns empty list when no pages exist", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT);
    const res = await listPagesRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  it("returns pages with template_status enrichment", async () => {
    const { B2BPage, HomeTemplate } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [],
      status: "published",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT);
    const res = await listPagesRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].slug).toBe("about");
    expect(body.data.items[0].template_status).toBe("published");
  });

  it("filters by status query param", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "active-page", title: "Active", status: "active" });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "inactive-page", title: "Inactive", status: "inactive" });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages?status=inactive`,
      TEST_TENANT
    );
    const res = await listPagesRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].slug).toBe("inactive-page");
  });

  it("paginates results", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "page-1", title: "Page 1", sort_order: 0 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "page-2", title: "Page 2", sort_order: 1 });
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "page-3", title: "Page 3", sort_order: 2 });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages?page=1&limit=2`,
      TEST_TENANT
    );
    const res = await listPagesRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.pagination.total).toBe(3);
    expect(body.data.pagination.totalPages).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT);
    const res = await listPagesRoute(req, listCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// POST /api/b2b/b2b/portals/[slug]/pages
// ============================================

describe("POST /api/b2b/b2b/portals/[slug]/pages", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "about",
      title: "About",
    });
    const res = await createPageRoute(req, listCtx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 400 when slug or title missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      title: "About",
    });
    const res = await createPageRoute(req, listCtx);
    expect(res.status).toBe(400);
  });

  it("creates a page and returns 201", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "about",
      title: "About Us",
    });
    const res = await createPageRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("about");
    expect(body.data.title).toBe("About Us");
    expect(body.data.portal_slug).toBe(PORTAL_SLUG);
  });

  it("persists the B2BPage document in the database", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "contact",
      title: "Contact",
    });
    await createPageRoute(req, listCtx);

    const { B2BPage } = await connectWithModels(TEST_DB);
    const saved = await B2BPage.findOne({ portal_slug: PORTAL_SLUG, slug: "contact" }).lean();
    expect(saved).not.toBeNull();
    expect((saved as any).title).toBe("Contact");
  });

  it("auto-inits the page template after create", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "faq",
      title: "FAQ",
    });
    await createPageRoute(req, listCtx);

    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const tpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-faq`,
    }).lean();
    expect(tpl).not.toBeNull();
    expect((tpl as any).status).toBe("draft");
  });

  it("returns 409 when slug already exists", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });

    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "about",
      title: "About Again",
    });
    const res = await createPageRoute(req, listCtx);
    expect(res.status).toBe(409);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages`, TEST_TENANT, {
      slug: "about",
      title: "About",
    });
    const res = await createPageRoute(req, listCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/pages/[pageSlug]", () => {
  it("returns 404 when page does not exist", async () => {
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await getPageRoute(req, pageCtx);
    expect(res.status).toBe(404);
  });

  it("returns the page when it exists", async () => {
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await getPageRoute(req, pageCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("about");
    expect(body.data.portal_slug).toBe(PORTAL_SLUG);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await getPageRoute(req, pageCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// PATCH /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
// ============================================

describe("PATCH /api/b2b/b2b/portals/[slug]/pages/[pageSlug]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT,
      { title: "Updated" }
    );
    const res = await updatePageRoute(req, pageCtx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 404 when page does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT,
      { title: "New Title" }
    );
    const res = await updatePageRoute(req, pageCtx);
    expect(res.status).toBe(404);
  });

  it("updates page fields after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPage } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "Old Title" });

    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT,
      { title: "New Title", show_in_nav: false }
    );
    const res = await updatePageRoute(req, pageCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("New Title");
    expect(body.data.show_in_nav).toBe(false);
  });

  it("migrates the template when slug changes", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPage, HomeTemplate } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [{ id: "b1", type: "text" }],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const newSlugCtx = { params: Promise.resolve({ slug: PORTAL_SLUG, pageSlug: "about" }) };
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT,
      { slug: "about-us" }
    );
    const res = await updatePageRoute(req, newSlugCtx);
    expect(res.status).toBe(200);

    // Old template doc should be gone
    const oldTpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
    }).lean();
    expect(oldTpl).toBeNull();

    // New template doc should exist with copied blocks
    const newTpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-about-us`,
    }).lean() as any;
    expect(newTpl).not.toBeNull();
    expect(newTpl.blocks).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT,
      { title: "X" }
    );
    const res = await updatePageRoute(req, pageCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// DELETE /api/b2b/b2b/portals/[slug]/pages/[pageSlug]
// ============================================

describe("DELETE /api/b2b/b2b/portals/[slug]/pages/[pageSlug]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await deletePageRoute(req, pageCtx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 404 when page does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await deletePageRoute(req, pageCtx);
    expect(res.status).toBe(404);
  });

  it("cascades deletion: page + template + form submissions", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPage, HomeTemplate, B2BFormSubmission } = await connectWithModels(TEST_DB);

    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      page_slug: "about",
      form_type: "page_form",
      data: { name: "Test" },
      seen: false,
    });

    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await deletePageRoute(req, pageCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify all three docs are gone
    const page = await B2BPage.findOne({ portal_slug: PORTAL_SLUG, slug: "about" }).lean();
    expect(page).toBeNull();

    const tpl = await HomeTemplate.findOne({ templateId: `b2b-${PORTAL_SLUG}-page-about` }).lean();
    expect(tpl).toBeNull();

    const submissions = await B2BFormSubmission.find({ portal_slug: PORTAL_SLUG, page_slug: "about" }).lean();
    expect(submissions).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about`,
      TEST_TENANT
    );
    const res = await deletePageRoute(req, pageCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/duplicate
// ============================================

describe("POST /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/duplicate", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about/duplicate`,
      TEST_TENANT
    );
    const res = await duplicatePageRoute(req, dupCtx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("returns 404 when source page does not exist", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about/duplicate`,
      TEST_TENANT
    );
    const res = await duplicatePageRoute(req, dupCtx);
    expect(res.status).toBe(404);
  });

  it("duplicates the page with -copy slug and returns 201", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPage, HomeTemplate } = await connectWithModels(TEST_DB);
    await B2BPage.create({ portal_slug: PORTAL_SLUG, slug: "about", title: "About" });
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-about`,
      portal_slug: PORTAL_SLUG,
      name: "About",
      version: 1,
      blocks: [{ id: "blk1", type: "hero", order: 0, config: {}, metadata: {} }],
      status: "draft",
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      isCurrent: true,
    });

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about/duplicate`,
      TEST_TENANT
    );
    const res = await duplicatePageRoute(req, dupCtx);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("about-copy");
    expect(body.data.title).toBe("About (Copy)");

    // Verify the copied template has the same blocks
    const copiedTpl = await HomeTemplate.findOne({
      templateId: `b2b-${PORTAL_SLUG}-page-about-copy`,
    }).lean() as any;
    expect(copiedTpl).not.toBeNull();
    expect(copiedTpl.blocks).toHaveLength(1);
    expect(copiedTpl.blocks[0].type).toBe("hero");
    expect(copiedTpl.status).toBe("draft");
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/pages/about/duplicate`,
      TEST_TENANT
    );
    const res = await duplicatePageRoute(req, dupCtx);
    expect(res.status).toBe(401);
  });
});
