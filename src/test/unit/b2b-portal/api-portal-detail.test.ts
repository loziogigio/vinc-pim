import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for B2BPortal + HomeSettings
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "api-detail-test";
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
const { GET, PATCH, DELETE } = await import("@/app/api/b2b/b2b/portals/[slug]/route");
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

  // Seed the tenant record so isTenantMigrated can find it
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Detail",
    status: "active",
    admin_email: "detail@example.com",
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
  const { B2BPortal, HomeSettings } = await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
  await HomeSettings.deleteMany({});
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
// GET /api/b2b/b2b/portals/[slug]
// ============================================

describe("GET /api/b2b/b2b/portals/[slug]", () => {
  it("returns 404 when nothing exists", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns synthesized portal from HomeSettings when unmigrated", async () => {
    const { HomeSettings } = await connectWithModels(TEST_DB);
    await HomeSettings.create({
      customerId: "api-detail-synth-customer",
      branding: { title: "Synth" },
      header_config: { rows: [] },
      footer: {},
      meta_tags: {},
      custom_scripts: [],
    });
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await GET(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.synthesized).toBe(true);
    expect(body.branding.title).toBe("Synth");
  });

  it("returns migrated portal when it exists in b2bportals", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "M", channel: "default" });
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await GET(req, ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.slug).toBe("default");
    expect(body.synthesized).toBeUndefined();
  });
});

// ============================================
// PATCH /api/b2b/b2b/portals/[slug]
// ============================================

describe("PATCH /api/b2b/b2b/portals/[slug]", () => {
  it("returns 409 NOT_MIGRATED when tenant not migrated", async () => {
    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default`, TEST_TENANT, { name: "X" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("patches the portal after migration", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "Old", channel: "default" });
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default`, TEST_TENANT, { name: "New" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("New");
  });

  it("returns 404 when patching non-existent portal (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default`, TEST_TENANT, { name: "X" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /api/b2b/b2b/portals/[slug]
// ============================================

describe("DELETE /api/b2b/b2b/portals/[slug]", () => {
  it("returns 409 NOT_MIGRATED when tenant not migrated", async () => {
    const req = buildAuthedRequest("DELETE", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("deletes the portal after migration", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "X", channel: "default" });
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("DELETE", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 when deleting non-existent portal (migrated)", async () => {
    await markTenantMigrated(TEST_TENANT);

    const req = buildAuthedRequest("DELETE", `/api/b2b/b2b/portals/default`, TEST_TENANT);
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });
});
