import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { B2BPageSchema } from "@/lib/db/models/b2b-page";

describe("B2BPage lang", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let Page: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    Page = conn.model("B2BPage", B2BPageSchema);
  }, 30000);
  beforeEach(async () => { await Page.deleteMany({}); await Page.syncIndexes(); });
  afterAll(async () => { await conn.dropDatabase(); await conn.close(); await mongod.stop(); });

  it("persists the provided lang", async () => {
    const withLang = await Page.create({ portal_slug: "default", slug: "kontakt", title: "Kontakt", lang: "de" });
    expect(withLang.lang).toBe("de");
  });

  it("requires lang (no static schema default — the service resolves it per tenant)", async () => {
    await expect(
      Page.create({ portal_slug: "default", slug: "contatti", title: "Contatti" })
    ).rejects.toThrow();
  });

  it("keeps slug globally unique per portal (so slug-keyed content stays separate)", async () => {
    await Page.create({ portal_slug: "default", slug: "contact", title: "C", lang: "it" });
    await expect(
      Page.create({ portal_slug: "default", slug: "contact", title: "K", lang: "de" })
    ).rejects.toThrow();
  });
});
