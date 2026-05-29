import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import { consolidateChannel } from "@/lib/services/solr-consolidation.service";

const Model = () =>
  (mongoose.models.PIMProductConsolTest as any) ||
  mongoose.model("PIMProductConsolTest", PIMProductSchema);

function baseProduct(entity_code: string, over: Record<string, any> = {}) {
  return {
    entity_code, sku: entity_code, version: 1, isCurrent: true,
    isCurrentPublished: true, status: "published", channels: ["b2b"],
    include_faceting: true, min_score_threshold: 80, required_fields: [],
    source: { source_id: "test-src", source_name: "Test", imported_at: new Date() },
    analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
    locked_fields: [], manually_edited: false, ...over,
  };
}

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

describe("consolidateChannel", () => {
  it("re-indexes only the missing published+searchable products and stamps them", async () => {
    const m = Model();
    await m.create(baseProduct("IN_SOLR"));   // already indexed (set below)
    await m.create(baseProduct("MISSING"));   // needs indexing
    await m.create(baseProduct("DRAFT", { status: "draft" })); // excluded
    await m.updateOne({ entity_code: "IN_SOLR" }, { $set: { solr_indexed_at: new Date() } }, { timestamps: false });

    // Fake Solr adapter: index the given products, report Solr already has IN_SOLR.
    const indexed: string[] = [];
    const adapter = {
      bulkIndexProducts: vi.fn(async (products: any[]) => {
        const codes = products.map((p) => p.entity_code);
        indexed.push(...codes);
        return { success: codes.length, failed: 0, errors: [], succeeded: codes, failedItems: [] };
      }),
      fetchAllEntityCodes: vi.fn(async () => ["IN_SOLR", "ORPHAN"]), // ORPHAN is stale
      deleteByIds: vi.fn(async () => {}),
    };

    const res = await consolidateChannel({
      model: m, adapter: adapter as any, channel: "b2b", removeStale: true,
    });

    // Only MISSING gets re-indexed.
    expect(indexed).toEqual(["MISSING"]);
    expect(res.indexed).toBe(1);
    // ORPHAN (in Solr, not published) is removed.
    expect(adapter.deleteByIds).toHaveBeenCalledWith(["ORPHAN"]);
    expect(res.removed).toBe(1);
    // MISSING now stamped.
    const after: any = await m.findOne({ entity_code: "MISSING" }).lean();
    expect(after.solr_indexed_at).toBeInstanceOf(Date);
  });

  it("re-indexes an explicit entity_codes set regardless of staleness", async () => {
    const m = Model();
    await m.create(baseProduct("X1"));
    await m.create(baseProduct("X2"));
    // Both already indexed — would NOT be 'missing'…
    await m.updateOne({ entity_code: "X1" }, { $set: { solr_indexed_at: new Date() } }, { timestamps: false });
    await m.updateOne({ entity_code: "X2" }, { $set: { solr_indexed_at: new Date() } }, { timestamps: false });

    const indexed: string[] = [];
    const adapter = {
      bulkIndexProducts: vi.fn(async (products: any[]) => {
        const codes = products.map((p) => p.entity_code);
        indexed.push(...codes);
        return { success: codes.length, failed: 0, errors: [], succeeded: codes, failedItems: [] };
      }),
      fetchAllEntityCodes: vi.fn(async () => []),
      deleteByIds: vi.fn(async () => {}),
    };

    const res = await consolidateChannel({
      model: m, adapter: adapter as any, entityCodes: ["X1"],
    });

    expect(indexed).toEqual(["X1"]); // only the requested one, even though not "missing"
    expect(res.indexed).toBe(1);
  });
});
