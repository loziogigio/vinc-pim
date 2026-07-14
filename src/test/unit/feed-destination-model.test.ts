import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { FeedDestinationSchema } from "@/lib/db/models/feed-destination";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
vi.mock("@/lib/db/build-guard", () => ({ assertNotBuildPhase: vi.fn() }));

describe("FeedDestination model", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    conn.model("FeedDestination", FeedDestinationSchema);
    await conn.models.FeedDestination.createIndexes();
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await conn.models.FeedDestination.deleteMany({});
  });

  it("creates a trovaprezzi destination with defaults", async () => {
    const doc = await conn.models.FeedDestination.create({
      destination_id: "fd_abc12345",
      type: "trovaprezzi",
      name: "TrovaPrezzi IT",
      channel: "default",
      lang: "it",
      currency: "EUR",
      product_url_template: "https://shop.deodato.it/p/{slug}",
      feed_token: "tok_x",
    });
    expect(doc.status).toBe("active");
    expect(doc.delta_interval_minutes).toBe(60);
    expect(doc.in_stock_only).toBe(false);
    expect(doc.created_at).toBeInstanceOf(Date);
  });

  it("rejects unknown destination types", async () => {
    await expect(
      conn.models.FeedDestination.create({
        destination_id: "fd_bad",
        type: "amazon",
        name: "Nope",
        channel: "default",
        lang: "it",
        currency: "EUR",
        product_url_template: "https://x/{slug}",
      })
    ).rejects.toThrow(/amazon/);
  });

  it("enforces unique destination_id", async () => {
    const base = {
      destination_id: "fd_dup",
      type: "trovaprezzi",
      name: "A",
      channel: "default",
      lang: "it",
      currency: "EUR",
      product_url_template: "https://x/{slug}",
    };
    await conn.models.FeedDestination.create(base);
    await expect(
      conn.models.FeedDestination.create({ ...base, name: "B" })
    ).rejects.toThrow(/duplicate key/);
  });
});
