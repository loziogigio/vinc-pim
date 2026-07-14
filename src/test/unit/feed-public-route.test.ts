import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { FeedDestinationSchema } from "@/lib/db/models/feed-destination";
import { PIMProductSchema } from "@/lib/db/models/pim-product";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));
// No Redis in unit tests: cache no-ops
vi.mock("@/lib/cache/redis-client", () => ({
  getRedis: vi.fn(() => null),
}));

const { GET } = await import("@/app/api/public/feeds/[destinationId]/route");

function reqFor(destinationId: string, qs: string) {
  return new NextRequest(`http://localhost/api/public/feeds/${destinationId}?${qs}`);
}
const paramsFor = (destinationId: string) => ({ params: Promise.resolve({ destinationId }) });

describe("public trovaprezzi feed route", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    conn.model("FeedDestination", FeedDestinationSchema);
    conn.model("PIMProduct", PIMProductSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await conn.models.FeedDestination.deleteMany({});
    await conn.models.PIMProduct.deleteMany({});
  });

  it("serves XML with the right token and 404s with a wrong one", async () => {
    await conn.models.FeedDestination.create({
      destination_id: "fd_tp", type: "trovaprezzi", name: "TP",
      channel: "default", lang: "it", currency: "EUR",
      product_url_template: "https://x/p/{slug}", feed_token: "good-token",
      shipping_cost: 4.9,
    });
    await conn.models.PIMProduct.create({
      entity_code: "A-1", sku: "A-1", version: 1,
      isCurrent: true, isCurrentPublished: true, status: "published",
      name: { it: "Prodotto A" }, slug: { it: "prodotto-a" },
      channels: ["default"], quantity: 2, sold: 0, unit: "pcs",
      pricing: { list: 12.5, currency: "EUR" },
    });

    const ok = await GET(reqFor("fd_tp", "tenant=test&token=good-token"), paramsFor("fd_tp"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/xml");
    const xml = await ok.text();
    expect(xml).toContain("<Name>Prodotto A</Name>");
    expect(xml).toContain("<ShippingCost>4.90</ShippingCost>");

    const bad = await GET(reqFor("fd_tp", "tenant=test&token=WRONG"), paramsFor("fd_tp"));
    expect(bad.status).toBe(404);
    const missing = await GET(reqFor("fd_tp", "tenant=test"), paramsFor("fd_tp"));
    expect(missing.status).toBe(404);
  });
});
