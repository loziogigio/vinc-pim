import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { GET, POST } from "@/app/api/b2b/b2b/portals/route";
import { buildAuthedRequest } from "@/test/helpers/auth";

const TEST_TENANT = "api-portals-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - conn: for B2BPortal
// ============================================

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

// Mock the pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Mock build-guard (connection-pool imports it)
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

// Mock auth — requireTenantAuth always succeeds with the test tenant
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
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

// ============================================
// HELPERS
// ============================================

async function clean() {
  const { B2BPortal } = await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
}

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  conn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-portals-list-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed the tenant record so isTenantMigrated can find it
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Portals List Test",
    status: "active",
    admin_email: "portals@example.com",
    solr_core: `vinc-${TEST_TENANT}`,
    mongo_db: TEST_DB,
    created_by: "test",
    domains: [],
    b2b_portal_migrated_at: null,
  });
}, 30000);

afterAll(async () => {
  await conn.dropDatabase();
  await adminConn.dropDatabase();
  await conn.close();
  await adminConn.close();
  await mongod.stop();
});

beforeEach(async () => {
  await clean();
  await clearTenantMigrationFlag(TEST_TENANT);
  vi.clearAllMocks();
  // Re-apply the auth mock after clearAllMocks
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
// GET /api/b2b/b2b/portals
// ============================================

describe("GET /api/b2b/b2b/portals", () => {
  it("returns an empty list when no portals exist", async () => {
    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals`, TEST_TENANT);
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("returns portals after one is created", async () => {
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "Main", channel: "default" });

    const req = buildAuthedRequest("GET", `/api/b2b/b2b/portals`, TEST_TENANT);
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items[0].slug).toBe("default");
  });
});

// ============================================
// POST /api/b2b/b2b/portals
// ============================================

describe("POST /api/b2b/b2b/portals", () => {
  it("returns 409 NOT_MIGRATED when tenant is not migrated", async () => {
    // Tenant flag is cleared in beforeEach — no markTenantMigrated call here
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "Main",
      slug: "default",
      channel: "default",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("creates a portal when tenant is migrated", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "Main",
      slug: "default",
      channel: "default",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.slug).toBe("default");
  });

  it("returns 400 when name or slug missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "",
      slug: "",
      channel: "default",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    await markTenantMigrated(TEST_TENANT);
    const { B2BPortal } = await connectWithModels(TEST_DB);
    await B2BPortal.create({ slug: "default", name: "A", channel: "default" });

    const req = buildAuthedRequest("POST", `/api/b2b/b2b/portals`, TEST_TENANT, {
      name: "B",
      slug: "default",
      channel: "default",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
