import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { B2BPageSchema } from "@/lib/db/models/b2b-page";

describe("B2BPage model", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let Page: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    Page = conn.model("B2BPage", B2BPageSchema);
  }, 30000);

  beforeEach(async () => {
    await Page.deleteMany({});
  });

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("stores under collection b2bpages", () => {
    expect(B2BPageSchema.get("collection")).toBe("b2bpages");
  });

  it("requires portal_slug, slug, title", async () => {
    await expect(Page.create({})).rejects.toThrow();
  });

  it("creates a page with minimal fields", async () => {
    const p = await Page.create({
      portal_slug: "default",
      slug: "about",
      title: "About",
    });
    expect(p.portal_slug).toBe("default");
    expect(p.slug).toBe("about");
  });

  it("rejects duplicate (portal_slug, slug)", async () => {
    await Page.create({ portal_slug: "default", slug: "x", title: "X" });
    await expect(
      Page.create({ portal_slug: "default", slug: "x", title: "X2" }),
    ).rejects.toThrow(/duplicate key/);
  });
});
