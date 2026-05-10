/**
 * Tests for src/scripts/verify-b2b-portal-migration.ts
 *
 * Uses MongoMemoryServer — never touches the real DB.
 * Pattern mirrors migration-flag.test.ts and migration-script.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TenantSchema } from "@/lib/db/models/admin-tenant";

// ── In-memory instance ───────────────────────────────────────────────────────

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;
let TenantModel: mongoose.Model<any>;

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

// Import the module under test AFTER mocks are in place
const { checkAllTenantsMigrated } = await import("@/scripts/verify-b2b-portal-migration");

// Import service functions for seeding (they use the mocked getTenantModel)
const {
  markTenantMigrated,
  clearTenantMigrationFlag,
} = await import("@/lib/services/b2b-portal-migration-flag.service");

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conn = await mongoose.createConnection(mongod.getUri()).asPromise();
  TenantModel = conn.model("Tenant", TenantSchema);
}, 60000);

afterAll(async () => {
  await conn?.dropDatabase();
  await conn?.close();
  await mongod?.stop();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seed(ids: string[], migrated: string[]) {
  for (const id of ids) {
    await TenantModel.updateOne(
      { tenant_id: id },
      { $set: { tenant_id: id, display_name: id, status: "active", domains: [] } },
      { upsert: true },
    );
  }
  for (const id of ids) {
    if (migrated.includes(id)) await markTenantMigrated(id);
    else await clearTenantMigrationFlag(id);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("verify-b2b-portal-migration", () => {
  beforeEach(async () => {
    await TenantModel.deleteMany({ tenant_id: { $in: ["ver-a", "ver-b"] } });
  });

  it("returns ok=true when all tenants migrated", async () => {
    await seed(["ver-a", "ver-b"], ["ver-a", "ver-b"]);
    const result = await checkAllTenantsMigrated();
    expect(result.ok).toBe(true);
    expect(result.unmigrated).toEqual([]);
  });

  it("returns ok=false and lists unmigrated tenants", async () => {
    await seed(["ver-a", "ver-b"], ["ver-a"]);
    const result = await checkAllTenantsMigrated();
    expect(result.ok).toBe(false);
    expect(result.unmigrated).toContain("ver-b");
  });
});
