import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { B2BUserSchema } from "@/lib/db/models/b2b-user";

describe("B2BUser RBAC fields", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let User: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    User = conn.model("B2BUser", B2BUserSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("accepts role_id and scope_values and defaults scope_values to 'all'", async () => {
    const u = await User.create({
      username: "agent1",
      email: "agent1@example.com",
      passwordHash: "x",
      companyName: "Acme",
      role: "admin", // legacy field still present/required
      role_id: "role_abc123",
    });
    expect(u.role_id).toBe("role_abc123");
    expect(u.scope_values.channels).toBe("all");
  });

  it("stores per-user channel scope values as an array", async () => {
    const u = await User.create({
      username: "agent2",
      email: "agent2@example.com",
      passwordHash: "x",
      companyName: "Acme",
      role: "manager",
      role_id: "role_def456",
      scope_values: { channels: ["retail"], customers: "all", price_lists: "all" },
    });
    expect(u.scope_values.channels).toEqual(["retail"]);
  });
});
