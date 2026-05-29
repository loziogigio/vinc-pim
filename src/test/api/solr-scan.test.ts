import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import { computeSyncScan, getScanChannels } from "@/lib/services/solr-consolidation.service";

const Model = () =>
  (mongoose.models.PIMProductScanTest as any) ||
  mongoose.model("PIMProductScanTest", PIMProductSchema);

function p(entity_code: string, over: Record<string, any> = {}) {
  return {
    entity_code, sku: entity_code, version: 1, isCurrent: true, isCurrentPublished: true,
    status: "published", channels: ["b2b"], include_faceting: true,
    min_score_threshold: 80, required_fields: [],
    source: { source_id: "s", source_name: "S", imported_at: new Date() },
    analytics: { views_30d: 0, clicks_30d: 0, add_to_cart_30d: 0, conversions_30d: 0, priority_score: 0 },
    locked_fields: [], manually_edited: false, ...over,
  };
}

beforeAll(async () => { await setupTestDatabase(); });
afterAll(async () => { await teardownTestDatabase(); });
beforeEach(async () => { await clearDatabase(); });

describe("getScanChannels", () => {
  it("returns distinct channels plus untagged when present", async () => {
    const m = Model();
    await m.create(p("A", { channels: ["b2b"] }));
    await m.create(p("B", { channels: ["b2c"] }));
    await m.create(p("C", { channels: [] }));
    const chans = await getScanChannels(m);
    expect(chans).toContain("b2b");
    expect(chans).toContain("b2c");
    expect(chans).toContain("(untagged)");
  });
});

describe("computeSyncScan", () => {
  it("reports per-channel published/indexed/missing/stale", async () => {
    const m = Model();
    await m.create(p("IN"));       // b2b, will be marked indexed
    await m.create(p("MISS"));     // b2b, never synced -> missing
    await m.updateOne({ entity_code: "IN" }, { $set: { solr_indexed_at: new Date() } }, { timestamps: false });

    const adapter = {
      countByQuery: vi.fn(async (q: string) => (q.includes("channels:b2b") ? 1 : 0)),
      fetchAllEntityCodes: vi.fn(async () => ["IN", "ORPHAN"]), // ORPHAN stale
      bulkIndexProducts: vi.fn(),
      deleteByIds: vi.fn(),
    };

    const scan = await computeSyncScan({ model: m, adapter: adapter as any, channels: ["b2b"] });
    const b2b = scan.channels.find((c) => c.channel === "b2b")!;
    expect(b2b.published).toBe(2);     // IN + MISS
    expect(b2b.missing).toBe(1);       // MISS
    expect(b2b.indexed).toBe(1);       // adapter.countByQuery
    expect(b2b.stale).toBe(1);         // ORPHAN
    expect(b2b.in_sync).toBe(false);
    expect(scan.totals.missing).toBe(1);
  });
});
