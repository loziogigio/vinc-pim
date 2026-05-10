import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { HomeTemplateSchema } from "@/lib/db/models/home-template";

describe("HomeTemplate with portal_slug", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let HT: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    HT = conn.model("HomeTemplate", HomeTemplateSchema);
    await HT.init(); // wait for indexes to be built before any test runs
  }, 30000);

  beforeEach(async () => {
    await HT.deleteMany({});
  });

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("defaults portal_slug to 'default'", async () => {
    const doc = await HT.create({
      templateId: "home",
      name: "Home",
      version: 1,
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
    expect(doc.portal_slug).toBe("default");
  });

  it("accepts explicit portal_slug", async () => {
    const doc = await HT.create({
      templateId: "home",
      name: "Home",
      version: 1,
      portal_slug: "beta",
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
    expect(doc.portal_slug).toBe("beta");
  });

  it("enforces unique (portal_slug, templateId, version)", async () => {
    const base = {
      templateId: "home",
      name: "Home",
      version: 1,
      portal_slug: "default",
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    };
    await HT.create(base);
    await expect(HT.create(base)).rejects.toThrow(/duplicate key/);
  });

  it("allows same (templateId, version) across different portal_slugs", async () => {
    await HT.create({
      templateId: "home",
      name: "Home",
      version: 1,
      portal_slug: "default",
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
    const doc2 = await HT.create({
      templateId: "home",
      name: "Home",
      version: 1,
      portal_slug: "beta",
      blocks: [],
      createdAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
    expect(doc2.portal_slug).toBe("beta");
  });
});
