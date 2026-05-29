import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import { listGapDetail } from "@/lib/services/solr-consolidation.service";

const Model = () =>
  (mongoose.models.PIMProductDetailTest as any) ||
  mongoose.model("PIMProductDetailTest", PIMProductSchema);

function p(entity_code: string, over: Record<string, any> = {}) {
  return {
    entity_code, sku: `SKU-${entity_code}`, version: 1, isCurrent: true, isCurrentPublished: true,
    status: "published", channels: ["b2b"], include_faceting: true,
    name: { it: `Prodotto ${entity_code}` },
    min_score_threshold: 80, required_fields: [],
    source: { source_id: "s", source_name: "S", job_id: "job-1", imported_at: new Date() },
    analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
    locked_fields: [], manually_edited: false, ...over,
  };
}

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

describe("listGapDetail missing", () => {
  it("paginates the channel's missing products with key fields", async () => {
    const m = Model();
    await m.create(p("M1"));
    await m.create(p("M2"));
    await m.create(p("OK"));
    await m.updateOne({ entity_code: "OK" }, { $set: { solr_indexed_at: new Date() } }, { timestamps: false });

    const res = await listGapDetail({
      model: m, adapter: { fetchAllEntityCodes: vi.fn() } as any,
      channel: "b2b", type: "missing", page: 1, limit: 10,
    });
    expect(res.pagination.total).toBe(2);
    const codes = res.items.map((i: any) => i.entity_code).sort();
    expect(codes).toEqual(["M1", "M2"]);
    expect(res.items[0]).toHaveProperty("name");
    expect(res.items[0]).toHaveProperty("source_job_id");
  });

  it("filters missing by q (entity_code/sku/name)", async () => {
    const m = Model();
    await m.create(p("ALPHA"));
    await m.create(p("BETA"));
    const res = await listGapDetail({
      model: m, adapter: { fetchAllEntityCodes: vi.fn() } as any,
      channel: "b2b", type: "missing", page: 1, limit: 10, q: "ALPHA",
    });
    expect(res.pagination.total).toBe(1);
    expect(res.items[0].entity_code).toBe("ALPHA");
  });
});

describe("listGapDetail stale", () => {
  it("paginates Solr codes not currently published, hydrating from Mongo", async () => {
    const m = Model();
    await m.create(p("PUB")); // published -> not stale
    const adapter = { fetchAllEntityCodes: vi.fn(async () => ["PUB", "ORPHAN1", "ORPHAN2"]) };
    const res = await listGapDetail({
      model: m, adapter: adapter as any, channel: "b2b", type: "stale", page: 1, limit: 10,
    });
    expect(res.pagination.total).toBe(2); // ORPHAN1, ORPHAN2
    expect(res.items.map((i: any) => i.entity_code).sort()).toEqual(["ORPHAN1", "ORPHAN2"]);
  });
});
