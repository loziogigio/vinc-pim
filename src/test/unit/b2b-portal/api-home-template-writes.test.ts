import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { buildAuthedRequest } from "@/test/helpers/auth";

// ============================================
// IN-MEMORY DB SETUP — two connections:
//   - adminConn: for the Tenant model (migration flag)
//   - tenantConn: for HomeTemplate
// ============================================

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

const TEST_TENANT = "home-tpl-writes-test";
const TEST_DB = `vinc-${TEST_TENANT}`;

const ctx = { params: Promise.resolve({ slug: "default" }) };

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
const { POST: saveDraftPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/save-draft/route"
);
const { POST: publishPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/publish/route"
);
const { POST: publishVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/publish-version/route"
);
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  tenantConn = await mongoose.createConnection(uri, { dbName: TEST_DB }).asPromise();
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-writes-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Seed the tenant record so isTenantMigrated can find it
  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Writes Test",
    status: "active",
    admin_email: "writes@example.com",
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
  const { HomeTemplate } = await connectWithModels(TEST_DB);
  await HomeTemplate.deleteMany({});
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
// MIGRATION GATE
// ============================================

describe("home-template writes enforce migration gate", () => {
  it("save-draft returns 409 NOT_MIGRATED when unmigrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/default/home-template/save-draft`,
      TEST_TENANT,
      { blocks: [] },
    );
    const res = await saveDraftPOST(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("publish returns 409 NOT_MIGRATED when unmigrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/default/home-template/publish`,
      TEST_TENANT,
      {},
    );
    const res = await publishPOST(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("publish-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/default/home-template/publish-version`,
      TEST_TENANT,
      { version: 1 },
    );
    const res = await publishVersionPOST(req, ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });
});

// ============================================
// WRITE SEMANTICS
// ============================================

describe("save-draft", () => {
  it("creates v1 after migration", async () => {
    await markTenantMigrated(TEST_TENANT);
    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/default/home-template/save-draft`,
      TEST_TENANT,
      { blocks: [{ id: "b1", type: "hero-full-width" }] },
    );
    const res = await saveDraftPOST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentVersion).toBe(1);
  });

  it("updates existing draft in-place (no new version)", async () => {
    await markTenantMigrated(TEST_TENANT);
    // First save
    await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [{ id: "b1" }] },
      ),
      ctx,
    );
    // Second save to the same draft
    const res = await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [{ id: "b2" }] },
      ),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Still version 1, not a new version
    expect(body.currentVersion).toBe(1);
    expect(body.versions).toHaveLength(1);
  });

  it("isolates writes by portal_slug", async () => {
    await markTenantMigrated(TEST_TENANT);
    await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [{ id: "default-block" }] },
      ),
      ctx,
    );
    // Different portal
    await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/beta/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [{ id: "beta-block" }] },
      ),
      { params: Promise.resolve({ slug: "beta" }) },
    );

    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const defaultDocs = await HomeTemplate.find({ portal_slug: "default" }).lean();
    const betaDocs = await HomeTemplate.find({ portal_slug: "beta" }).lean();
    expect(defaultDocs.length).toBe(1);
    expect(betaDocs.length).toBe(1);
    expect((defaultDocs[0] as any).blocks[0].id).toBe("default-block");
    expect((betaDocs[0] as any).blocks[0].id).toBe("beta-block");
  });
});

describe("publish", () => {
  it("marks current draft version as published", async () => {
    await markTenantMigrated(TEST_TENANT);
    // Create a draft first
    await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [] },
      ),
      ctx,
    );
    const res = await publishPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/publish`,
        TEST_TENANT,
        {},
      ),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const published = body.versions.find((v: any) => v.status === "published");
    expect(published).toBeDefined();
  });
});

describe("publish-version", () => {
  it("targets a specific version", async () => {
    await markTenantMigrated(TEST_TENANT);
    await saveDraftPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/save-draft`,
        TEST_TENANT,
        { blocks: [] },
      ),
      ctx,
    );
    const res = await publishVersionPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/publish-version`,
        TEST_TENANT,
        { version: 1 },
      ),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const published = body.versions.find((v: any) => v.status === "published");
    expect(published?.version).toBe(1);
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await publishVersionPOST(
      buildAuthedRequest(
        "POST",
        `/api/b2b/b2b/portals/default/home-template/publish-version`,
        TEST_TENANT,
        { notversion: "oops" },
      ),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("auth required", () => {
  it("save-draft returns 401 when not authenticated", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as any);

    const req = buildAuthedRequest(
      "POST",
      `/api/b2b/b2b/portals/default/home-template/save-draft`,
      TEST_TENANT,
      { blocks: [] },
    );
    const res = await saveDraftPOST(req, ctx);
    expect(res.status).toBe(401);
  });
});
