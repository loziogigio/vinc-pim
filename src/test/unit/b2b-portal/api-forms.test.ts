import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BFormSubmission
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "api-forms-test";
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
const { GET: listFormsRoute } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/forms/route"
);
const {
  GET: getFormRoute,
  PATCH: patchFormRoute,
  DELETE: deleteFormRoute,
} = await import("@/app/api/b2b/b2b/portals/[slug]/forms/[id]/route");
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

const listCtx = { params: Promise.resolve({ slug: PORTAL_SLUG }) };

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-forms-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed tenant record
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Forms Test Tenant",
    status: "active",
    admin_email: "forms@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });

  // Ensure indexes are built before running tests
  const { B2BFormSubmission } = await connectWithModels(TEST_DB);
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
  const { B2BFormSubmission } = await connectWithModels(TEST_DB);
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
// GET /api/b2b/b2b/portals/[slug]/forms
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/forms", () => {
  it("returns empty list when no submissions exist", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms`, TEST_TENANT);
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  it("returns submissions sorted by created_at descending", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    // Create submissions with distinct timestamps
    const t1 = new Date("2024-01-01T10:00:00Z");
    const t2 = new Date("2024-01-02T10:00:00Z");
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: { message: "first" },
      seen: false,
      created_at: t1,
    });
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: { message: "second" },
      seen: false,
      created_at: t2,
    });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms`, TEST_TENANT);
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    // Most recent first
    expect(body.data.items[0].data.message).toBe("second");
    expect(body.data.items[1].data.message).toBe("first");
  });

  it("filters by page_slug", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      page_slug: "contact",
      form_type: "page_form",
      data: {},
      seen: false,
    });
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      page_slug: "about",
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms?page_slug=contact`,
      TEST_TENANT
    );
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].page_slug).toBe("contact");
  });

  it("filters by form_type", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "standalone",
      data: {},
      seen: false,
    });

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms?form_type=standalone`,
      TEST_TENANT
    );
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].form_type).toBe("standalone");
  });

  it("paginates results", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    for (let i = 0; i < 5; i++) {
      await B2BFormSubmission.create({
        portal_slug: PORTAL_SLUG,
        form_type: "page_form",
        data: { index: i },
        seen: false,
      });
    }

    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms?page=1&limit=3`,
      TEST_TENANT
    );
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(3);
    expect(body.data.pagination.total).toBe(5);
    expect(body.data.pagination.totalPages).toBe(2);
  });

  it("does not return submissions from other portals", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });
    await B2BFormSubmission.create({
      portal_slug: "other-portal",
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms`, TEST_TENANT);
    const res = await listFormsRoute(req, listCtx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].portal_slug).toBe(PORTAL_SLUG);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms`, TEST_TENANT);
    const res = await listFormsRoute(req, listCtx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// GET /api/b2b/b2b/portals/[slug]/forms/[id]
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]/forms/[id]", () => {
  it("returns 404 when submission does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`, TEST_TENANT);
    const res = await getFormRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns the submission when it exists", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: { name: "Test User" },
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT
    );
    const res = await getFormRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.portal_slug).toBe(PORTAL_SLUG);
    expect(body.data.data.name).toBe("Test User");
  });

  it("returns 404 when submission belongs to a different portal", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: "other-portal",
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "GET",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT
    );
    const res = await getFormRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`, TEST_TENANT);
    const res = await getFormRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// PATCH /api/b2b/b2b/portals/[slug]/forms/[id]
// ============================================

describe("PATCH /api/b2b/b2b/portals/[slug]/forms/[id]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT,
      { seen: true }
    );
    const res = await patchFormRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("flips seen to true after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT,
      { seen: true }
    );
    const res = await patchFormRoute(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.seen).toBe(true);

    // Verify persisted
    const updated = await B2BFormSubmission.findById(doc._id).lean();
    expect((updated as any).seen).toBe(true);
  });

  it("returns 404 when submission does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`,
      TEST_TENANT,
      { seen: true }
    );
    const res = await patchFormRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest(
      "PATCH",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`,
      TEST_TENANT,
      { seen: true }
    );
    const res = await patchFormRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ============================================
// DELETE /api/b2b/b2b/portals/[slug]/forms/[id]
// ============================================

describe("DELETE /api/b2b/b2b/portals/[slug]/forms/[id]", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT
    );
    const res = await deleteFormRoute(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("deletes the submission after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const doc = await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      form_type: "page_form",
      data: {},
      seen: false,
    });

    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: doc._id.toString() }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${doc._id}`,
      TEST_TENANT
    );
    const res = await deleteFormRoute(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify removed from DB
    const gone = await B2BFormSubmission.findById(doc._id).lean();
    expect(gone).toBeNull();
  });

  it("returns 404 when submission does not exist (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);
    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`,
      TEST_TENANT
    );
    const res = await deleteFormRoute(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const ctx = { params: Promise.resolve({ slug: PORTAL_SLUG, id: fakeId }) };
    const req = buildAuthedRequest(
      "DELETE",
      `/api/b2b/b2b/portals/${PORTAL_SLUG}/forms/${fakeId}`,
      TEST_TENANT
    );
    const res = await deleteFormRoute(req, ctx);
    expect(res.status).toBe(401);
  });
});
