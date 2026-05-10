/**
 * Tests for src/scripts/migrate-b2b-portal.ts
 *
 * All DB access is mocked with MongoMemoryServer — never touches the real DB.
 * Pattern mirrors migration-flag.test.ts: mock getTenantModel + connectWithModels.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";
import { B2BPortalSchema } from "@/lib/db/models/b2b-portal";
import { HomeTemplateSchema } from "@/lib/db/models/home-template";
import { HomeSettingsSchema } from "@/lib/db/models/home-settings";

// ── In-memory instances ──────────────────────────────────────────────────────

let adminMongod: MongoMemoryServer;
let adminConn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

let tenantMongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;
let B2BPortalModel: mongoose.Model<any>;
let HomeTemplateModel: mongoose.Model<any>;
let HomeSettingsModel: mongoose.Model<any>;

// ── Mocks — must be declared before importing the module under test ───────────

vi.mock("@/lib/db/models/admin-tenant", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db/models/admin-tenant")>();
  return {
    ...original,
    getTenantModel: vi.fn(async () => TenantModel),
  };
});

vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

vi.mock("@/lib/db/admin-connection", () => ({
  connectToAdminDatabase: vi.fn(async () => adminConn),
}));

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async (_dbName: string) => ({
    B2BPortal: B2BPortalModel,
    HomeTemplate: HomeTemplateModel,
    HomeSettings: HomeSettingsModel,
  })),
}));

// Import the module under test AFTER mocks are in place
const { migrateOneTenant, rollbackOneTenant } = await import(
  "@/scripts/migrate-b2b-portal"
);

// ── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = "migscript-test";
const TEST_DB = "vinc-migscript-test";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedTenant() {
  await TenantModel.deleteOne({ tenant_id: TENANT_ID });
  await TenantModel.create({
    tenant_id: TENANT_ID,
    name: "MigScript Test",
    display_name: "MigScript Test",
    status: "active",
    admin_email: "test@example.com",
    solr_core: `vinc-${TENANT_ID}`,
    mongo_db: TEST_DB,
    created_by: "test",
    db_config: { mongo_db: TEST_DB },
    domains: [],
    b2b_portal_migrated_at: null,
  });

  await B2BPortalModel.deleteMany({});
  await HomeSettingsModel.deleteMany({});
  await HomeTemplateModel.deleteMany({});

  await HomeSettingsModel.create({
    customerId: TENANT_ID,
    branding: { title: "MigTest" },
    headerConfig: { rows: [] },
    meta_tags: {},
  });
  // Insert WITHOUT portal_slug to simulate a pre-migration document
  // (bypassing Mongoose schema defaults via raw insertOne)
  await HomeTemplateModel.collection.insertOne({
    templateId: "home",
    name: "Home",
    version: 1,
    blocks: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    // portal_slug deliberately omitted — this is what migration must backfill
  });
}

// ── Test setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Admin DB
  adminMongod = await MongoMemoryServer.create();
  adminConn = await mongoose.createConnection(adminMongod.getUri()).asPromise();
  TenantModel = adminConn.model("Tenant", TenantSchema);

  // Tenant DB
  tenantMongod = await MongoMemoryServer.create();
  tenantConn = await mongoose.createConnection(tenantMongod.getUri()).asPromise();
  B2BPortalModel = tenantConn.model("B2BPortal", B2BPortalSchema);
  HomeTemplateModel = tenantConn.model("HomeTemplate", HomeTemplateSchema);
  HomeSettingsModel = tenantConn.model("HomeSettings", HomeSettingsSchema);
}, 60000);

afterAll(async () => {
  await adminConn?.dropDatabase();
  await adminConn?.close();
  await adminMongod?.stop();

  await tenantConn?.dropDatabase();
  await tenantConn?.close();
  await tenantMongod?.stop();
});

beforeEach(seedTenant);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("migrate-b2b-portal script", () => {
  it("migrateOneTenant inserts a portal with slug='default'", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });

    const p = await B2BPortalModel.findOne({ slug: "default" }).lean();
    expect(p).not.toBeNull();
    expect(p?.name).toBe("MigScript Test");
    expect(p?.branding?.title).toBe("MigTest");
  }, 30000);

  it("migrateOneTenant backfills portal_slug on HomeTemplate docs", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });

    const ht = await HomeTemplateModel.findOne({}).lean();
    expect(ht?.portal_slug).toBe("default");
  }, 30000);

  it("migrateOneTenant is idempotent without --force (no duplicates)", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });
    // Second run: already migrated — should be skipped
    const result = await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });

    expect(result.status).toBe("skipped");
    expect(await B2BPortalModel.countDocuments({})).toBe(1);
  }, 30000);

  it("migrateOneTenant with --dry-run makes no writes", async () => {
    const result = await migrateOneTenant(TENANT_ID, { dryRun: true, force: false });

    expect(result.status).toBe("dry-run");
    expect(await B2BPortalModel.countDocuments({})).toBe(0);
    // The seed inserts the HomeTemplate doc via raw insertOne (no schema defaults),
    // so portal_slug must still be absent — dry-run must not have run updateMany
    const ht = await HomeTemplateModel.findOne({}).lean();
    expect(ht?.portal_slug).toBeUndefined();
  }, 30000);

  it("sets the b2b_portal_migrated_at flag on the admin tenant record", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });

    const doc = await TenantModel.findOne({ tenant_id: TENANT_ID }).lean();
    expect(doc?.b2b_portal_migrated_at).toBeTruthy();
    expect(doc?.b2b_portal_migrated_at).toBeInstanceOf(Date);
  }, 30000);

  it("writes audit entry to migration_log in admin DB", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });

    const log = await adminConn.db
      .collection("migration_log")
      .findOne({ tenant_id: TENANT_ID, script: "migrate-b2b-portal" });
    expect(log).not.toBeNull();
    expect(log?.result).toBe("success");
  }, 30000);

  it("rollbackOneTenant removes the b2bportals doc, clears the flag, and unsets portal_slug on templates", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });
    // Confirm migration backfilled portal_slug before rolling back
    const htAfterMigrate = await HomeTemplateModel.findOne({}).lean();
    expect(htAfterMigrate?.portal_slug).toBe("default");

    await rollbackOneTenant(TENANT_ID);

    expect(await B2BPortalModel.countDocuments({})).toBe(0);

    const doc = await TenantModel.findOne({ tenant_id: TENANT_ID }).lean();
    expect(doc?.b2b_portal_migrated_at).toBeFalsy();

    // Rollback must un-backfill portal_slug from HomeTemplate docs
    const ht = await HomeTemplateModel.findOne({}).lean();
    expect(ht?.portal_slug).toBeUndefined();
  }, 30000);

  it("rollbackOneTenant writes a rollback audit entry", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });
    await rollbackOneTenant(TENANT_ID);

    const log = await adminConn.db
      .collection("migration_log")
      .findOne({ tenant_id: TENANT_ID, script: "migrate-b2b-portal", result: "rollback" });
    expect(log).not.toBeNull();
  }, 30000);

  it("skips tenant with no b2bhomesettings doc gracefully", async () => {
    await HomeSettingsModel.deleteMany({});

    const result = await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });
    expect(result.status).toBe("skipped");
    expect(result.details).toMatch(/no b2bhomesettings/);
  }, 30000);

  it("--force re-migrates an already-migrated tenant", async () => {
    await migrateOneTenant(TENANT_ID, { dryRun: false, force: false });
    const result = await migrateOneTenant(TENANT_ID, { dryRun: false, force: true });

    expect(result.status).toBe("migrated");
    // Still only one portal doc (upsert, not duplicate)
    expect(await B2BPortalModel.countDocuments({})).toBe(1);
  }, 30000);
});
