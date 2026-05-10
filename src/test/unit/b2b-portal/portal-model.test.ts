import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { B2BPortalSchema } from "@/lib/db/models/b2b-portal";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

describe("B2BPortal model", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let Portal: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    Portal = conn.model("B2BPortal", B2BPortalSchema);
  }, 30000);

  beforeEach(async () => {
    await Portal.deleteMany({});
  });

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("creates a portal with minimal fields", async () => {
    const p = await Portal.create({
      slug: DEFAULT_PORTAL_SLUG,
      name: "Main B2B",
      channel: "default",
    });
    expect(p.slug).toBe("default");
    expect(p.status).toBe("active");
    expect(p.domains).toEqual([]);
    expect(p.header_config.toObject()).toEqual({ rows: [] });
  });

  it("rejects duplicate slug", async () => {
    await Portal.create({ slug: "default", name: "A", channel: "ch1" });
    await expect(
      Portal.create({ slug: "default", name: "B", channel: "ch2" }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects invalid status", async () => {
    await expect(
      Portal.create({ slug: "x", name: "X", channel: "chx", status: "weird" }),
    ).rejects.toThrow();
  });

  it("stores under collection b2bportals", () => {
    expect(B2BPortalSchema.get("collection")).toBe("b2bportals");
  });

  it("uses created_at/updated_at timestamps", async () => {
    const p = await Portal.create({ slug: "x", name: "X", channel: "chx" });
    expect(p.created_at).toBeInstanceOf(Date);
    expect(p.updated_at).toBeInstanceOf(Date);
  });
});
