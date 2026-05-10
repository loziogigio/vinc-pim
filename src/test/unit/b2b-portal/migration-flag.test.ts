import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

// Mock getTenantModel to return our in-memory model
vi.mock("@/lib/db/models/admin-tenant", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/models/admin-tenant")>();
  return {
    ...original,
    getTenantModel: vi.fn(async () => TenantModel),
  };
});

// Also mock build-guard (admin-connection imports it)
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

const { isTenantMigrated, markTenantMigrated, clearTenantMigrationFlag, listUnmigratedTenants } =
  await import("@/lib/services/b2b-portal-migration-flag.service");

const TENANT_ID = "test-tenant-migflag";

describe("b2b_portal_migrated_at flag", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    TenantModel = conn.model("Tenant", TenantSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await TenantModel.deleteOne({ tenant_id: TENANT_ID });
    await TenantModel.create({
      tenant_id: TENANT_ID,
      name: "Test",
      status: "active",
      admin_email: "test@example.com",
      solr_core: "vinc-test-tenant-migflag",
      mongo_db: "vinc-test-tenant-migflag",
      created_by: "test",
      domains: [],
    });
  });

  it("isTenantMigrated returns false for fresh tenant", async () => {
    expect(await isTenantMigrated(TENANT_ID)).toBe(false);
  });

  it("markTenantMigrated sets the flag", async () => {
    await markTenantMigrated(TENANT_ID);
    expect(await isTenantMigrated(TENANT_ID)).toBe(true);
  });

  it("clearTenantMigrationFlag unsets the flag", async () => {
    await markTenantMigrated(TENANT_ID);
    await clearTenantMigrationFlag(TENANT_ID);
    expect(await isTenantMigrated(TENANT_ID)).toBe(false);
  });

  it("listUnmigratedTenants includes tenant without flag", async () => {
    const list = await listUnmigratedTenants();
    expect(list).toContain(TENANT_ID);
  });

  it("listUnmigratedTenants excludes migrated tenant", async () => {
    await markTenantMigrated(TENANT_ID);
    const list = await listUnmigratedTenants();
    expect(list).not.toContain(TENANT_ID);
  });
});
