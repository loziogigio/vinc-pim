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

const TEST_TENANT = "home-tpl-ver-test";
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
const { POST: deleteVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/delete-version/route"
);
const { POST: duplicateVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/duplicate-version/route"
);
const { POST: loadVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/load-version/route"
);
const { POST: startNewVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/start-new-version/route"
);
const { POST: unpublishVersionPOST } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/unpublish-version/route"
);
const { PATCH: updateVersionPATCH } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/home-template/update-version/route"
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
  adminConn = await mongoose.createConnection(uri, { dbName: "vinc-admin-ver-mgmt-test" }).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  await TenantModel.create({
    tenant_id: TEST_TENANT,
    name: "Version Mgmt Test",
    status: "active",
    admin_email: "vermgmt@example.com",
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
// MIGRATION GATE — write routes only
// ============================================

describe("version management write endpoints enforce migration gate", () => {
  it("delete-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await deleteVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/delete-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("duplicate-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await duplicateVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/duplicate-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("load-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await loadVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/load-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("start-new-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("unpublish-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await unpublishVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/unpublish-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });

  it("update-version returns 409 NOT_MIGRATED when unmigrated", async () => {
    const res = await updateVersionPATCH(
      buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/home-template/update-version`, TEST_TENANT, { version: 1, label: "Test" }),
      ctx,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_MIGRATED");
  });
});

// ============================================
// VERSION MANAGEMENT SEMANTICS
// ============================================

describe("start-new-version", () => {
  it("increments version number", async () => {
    await markTenantMigrated(TEST_TENANT);
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    const res = await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentVersion).toBeGreaterThan(1);
    expect(body.versions).toHaveLength(2);
  });

  it("returns 400 when no versions exist", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );
    expect(res.status).toBe(500);
  });
});

describe("duplicate-version", () => {
  it("creates a new draft from an existing version", async () => {
    await markTenantMigrated(TEST_TENANT);
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, {
        blocks: [{ id: "blk1" }],
      }),
      ctx,
    );
    const res = await duplicateVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/duplicate-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBe(2);
    expect(body.currentVersion).toBe(2);
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await duplicateVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/duplicate-version`, TEST_TENANT, { notversion: "oops" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("load-version", () => {
  it("marks the requested version as current", async () => {
    await markTenantMigrated(TEST_TENANT);
    // Create v1
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    // Create v2
    await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );
    // Load v1
    const res = await loadVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/load-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentVersion).toBe(1);
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await loadVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/load-version`, TEST_TENANT, { notversion: "oops" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("delete-version", () => {
  it("removes a non-current version", async () => {
    await markTenantMigrated(TEST_TENANT);
    // Create v1
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    // Create v2 (becomes current)
    await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );
    // Delete v1 (not current)
    const res = await deleteVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/delete-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toHaveLength(1);
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await deleteVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/delete-version`, TEST_TENANT, { notversion: "oops" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("update-version", () => {
  it("updates the label of a version", async () => {
    await markTenantMigrated(TEST_TENANT);
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    const res = await updateVersionPATCH(
      buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/home-template/update-version`, TEST_TENANT, {
        version: 1,
        label: "Hello",
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const v1 = body.versions.find((v: any) => v.version === 1);
    expect(v1.label).toBe("Hello");
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await updateVersionPATCH(
      buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/home-template/update-version`, TEST_TENANT, { label: "No version" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when label is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await updateVersionPATCH(
      buildAuthedRequest("PATCH", `/api/b2b/b2b/portals/default/home-template/update-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("unpublish-version", () => {
  it("reverts a published version to draft", async () => {
    await markTenantMigrated(TEST_TENANT);
    // Create and publish v1
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    const { POST: publishPOST } = await import(
      "@/app/api/b2b/b2b/portals/[slug]/home-template/publish/route"
    );
    await publishPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/publish`, TEST_TENANT, {}),
      ctx,
    );
    // Unpublish v1
    const res = await unpublishVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/unpublish-version`, TEST_TENANT, { version: 1 }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const v1 = body.versions.find((v: any) => v.version === 1);
    expect(v1.status).toBe("draft");
  });

  it("returns 400 when version is missing", async () => {
    await markTenantMigrated(TEST_TENANT);
    const res = await unpublishVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/unpublish-version`, TEST_TENANT, { notversion: "oops" }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("portal isolation", () => {
  it("version operations are scoped to the correct portal_slug", async () => {
    await markTenantMigrated(TEST_TENANT);
    // Create v1 in "default" portal
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      ctx,
    );
    // Create v1 in "beta" portal
    await saveDraftPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/beta/home-template/save-draft`, TEST_TENANT, { blocks: [] }),
      { params: Promise.resolve({ slug: "beta" }) },
    );
    // Start new version in "default" only
    await startNewVersionPOST(
      buildAuthedRequest("POST", `/api/b2b/b2b/portals/default/home-template/start-new-version`, TEST_TENANT, {}),
      ctx,
    );

    const { HomeTemplate } = await connectWithModels(TEST_DB);
    const defaultDocs = await HomeTemplate.find({ portal_slug: "default" }).lean();
    const betaDocs = await HomeTemplate.find({ portal_slug: "beta" }).lean();
    expect(defaultDocs).toHaveLength(2);
    expect(betaDocs).toHaveLength(1);
  });
});
