import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { setupTestDatabase, teardownTestDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { RoleSchema } from "@/lib/db/models/role";

describe("Role model", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let Role: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    Role = conn.model("Role", RoleSchema);
    await Role.init();
  }, 30000);

  beforeEach(async () => {
    await Role.deleteMany({});
  });

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("creates a role with generated role_id and defaults", async () => {
    const r = await Role.create({
      name: "Helpdesk",
      permissions: ["orders.view"],
      scope: { channels: "all", customers: "all", price_lists: "all" },
    });
    expect(r.role_id).toMatch(/^role_/);
    expect(r.is_system).toBe(false);
    expect(r.is_active).toBe(true);
    expect(r.created_at).toBeInstanceOf(Date);
  });

  it("rejects a duplicate role_id", async () => {
    await Role.create({ role_id: "role_dup", name: "A", scope: { channels: "all", customers: "all", price_lists: "all" } });
    await expect(
      Role.create({ role_id: "role_dup", name: "B", scope: { channels: "all", customers: "all", price_lists: "all" } })
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects an invalid scope enum value", async () => {
    await expect(
      Role.create({ name: "X", scope: { channels: "sometimes", customers: "all", price_lists: "all" } })
    ).rejects.toThrow();
  });

  it("stores under collection 'roles'", () => {
    expect(RoleSchema.get("collection")).toBe("roles");
  });
});

describe("Role registry wiring", () => {
  beforeAll(async () => { await setupTestDatabase(); }, 30000);
  afterAll(async () => { await teardownTestDatabase(); });

  it("connectWithModels exposes the Role model", async () => {
    const models = await connectWithModels("vinc-test");
    expect(models.Role).toBeTruthy();
    expect(models.Role.modelName).toBe("Role");
  });
});
