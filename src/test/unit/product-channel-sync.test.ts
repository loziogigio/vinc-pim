/**
 * Tests for the product → channel sync service.
 *
 * - `syncProductToChannels` is the pure orchestration core: given a product, a
 *   map of channel adapters, and the channels to push to, it syncs each present
 *   channel and reports a per-channel outcome. No DB/queue — plain fakes.
 * - `syncProductToChannelsNow` is the glue: loads the current product, resolves
 *   enabled adapters, syncs the synchronous channels (Solr), and stamps
 *   solr_indexed_at only when Solr acked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncProductToChannels,
  syncProductToChannelsNow,
  propagateProductEdit,
  SYNCHRONOUS_SYNC_CHANNELS,
} from "@/lib/services/product-channel-sync";
import { connectWithModels } from "@/lib/db/connection";
import { initializeAdapters } from "@/lib/adapters";
import { markSolrIndexed } from "@/lib/services/solr-sync-state";
import { syncProductToMarketplaces, getEnabledChannels } from "@/lib/sync/marketplace-sync";

vi.mock("@/lib/db/connection", () => ({ connectWithModels: vi.fn() }));
vi.mock("@/lib/adapters", () => ({ initializeAdapters: vi.fn() }));
vi.mock("@/lib/services/solr-sync-state", () => ({ markSolrIndexed: vi.fn(async () => {}) }));
vi.mock("@/lib/sync/marketplace-sync", () => ({
  syncProductToMarketplaces: vi.fn(async () => ({})),
  getEnabledChannels: vi.fn(() => ["solr"]),
}));

type FakeResult = { success: boolean; status?: string; message?: string };

function fakeAdapter(name: string, result: FakeResult = { success: true }) {
  return { name, syncProduct: vi.fn(async () => result) };
}

function mockCurrentProduct(product: any) {
  vi.mocked(connectWithModels).mockResolvedValue({
    PIMProduct: { findOne: () => ({ lean: () => Promise.resolve(product) }) },
  } as any);
}

describe("syncProductToChannels (pure core)", () => {
  it("syncs each requested channel present in the adapter map and reports its outcome", async () => {
    const solr = fakeAdapter("solr", { success: true, message: "indexed" });
    const adapters = new Map<string, any>([["solr", solr]]);
    const product = { entity_code: "A1" };

    const outcomes = await syncProductToChannels(product, adapters, ["solr"]);

    expect(solr.syncProduct).toHaveBeenCalledWith(product);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ channel: "solr", success: true, message: "indexed" });
  });

  it("skips requested channels that are not in the adapter map (disabled)", async () => {
    const solr = fakeAdapter("solr");
    const adapters = new Map<string, any>([["solr", solr]]);

    const outcomes = await syncProductToChannels({ entity_code: "A1" }, adapters, ["solr", "ebay"]);

    expect(outcomes.map((o) => o.channel)).toEqual(["solr"]);
  });

  it("isolates a failing channel: one adapter throwing does not block the others", async () => {
    const solr = fakeAdapter("solr", { success: true });
    const b2c = { name: "b2c", syncProduct: vi.fn(async () => { throw new Error("b2c down"); }) };
    const adapters = new Map<string, any>([["solr", solr], ["b2c", b2c]]);

    const outcomes = await syncProductToChannels({ entity_code: "A1" }, adapters, ["solr", "b2c"]);

    expect(outcomes).toContainEqual(expect.objectContaining({ channel: "solr", success: true }));
    expect(outcomes).toContainEqual(
      expect.objectContaining({ channel: "b2c", success: false, message: "b2c down" }),
    );
  });
});

describe("syncProductToChannelsNow (glue)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs a published product to Solr and stamps solr_indexed_at", async () => {
    mockCurrentProduct({ entity_code: "A1", status: "published" });
    const solr = fakeAdapter("solr");
    vi.mocked(initializeAdapters).mockResolvedValue(new Map([["solr", solr]]) as any);

    const outcomes = await syncProductToChannelsNow("A1", "hidros-it", "vinc-hidros-it");

    expect(solr.syncProduct).toHaveBeenCalled();
    expect(outcomes).toContainEqual(expect.objectContaining({ channel: "solr", success: true }));
    expect(vi.mocked(markSolrIndexed)).toHaveBeenCalledWith(expect.anything(), ["A1"]);
  });

  it("skips a draft product — no adapters initialized, no Solr stamp", async () => {
    mockCurrentProduct({ entity_code: "A1", status: "draft" });

    const outcomes = await syncProductToChannelsNow("A1", "hidros-it", "vinc-hidros-it");

    expect(outcomes).toEqual([]);
    expect(vi.mocked(initializeAdapters)).not.toHaveBeenCalled();
    expect(vi.mocked(markSolrIndexed)).not.toHaveBeenCalled();
  });

  it("returns [] when the product is not found", async () => {
    mockCurrentProduct(null);

    const outcomes = await syncProductToChannelsNow("nope", "hidros-it", "vinc-hidros-it");

    expect(outcomes).toEqual([]);
  });

  it("does NOT stamp solr_indexed_at when the Solr sync fails", async () => {
    mockCurrentProduct({ entity_code: "A1", status: "published" });
    const solr = fakeAdapter("solr", { success: false, message: "solr error" });
    vi.mocked(initializeAdapters).mockResolvedValue(new Map([["solr", solr]]) as any);

    await syncProductToChannelsNow("A1", "hidros-it", "vinc-hidros-it");

    expect(vi.mocked(markSolrIndexed)).not.toHaveBeenCalled();
  });

  it("defaults to the synchronous allowlist (Solr) and does not touch marketplaces", async () => {
    expect(SYNCHRONOUS_SYNC_CHANNELS).toEqual(["solr"]);
    mockCurrentProduct({ entity_code: "A1", status: "published" });
    const solr = fakeAdapter("solr");
    const ebay = fakeAdapter("ebay");
    vi.mocked(initializeAdapters).mockResolvedValue(
      new Map([["solr", solr], ["ebay", ebay]]) as any,
    );

    await syncProductToChannelsNow("A1", "hidros-it", "vinc-hidros-it");

    expect(solr.syncProduct).toHaveBeenCalled();
    expect(ebay.syncProduct).not.toHaveBeenCalled();
  });
});

describe("propagateProductEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentProduct({ entity_code: "A1", status: "published" });
    vi.mocked(initializeAdapters).mockResolvedValue(new Map([["solr", fakeAdapter("solr")]]) as any);
  });

  it("syncs Solr immediately and does NOT queue when only Solr is enabled", async () => {
    vi.mocked(getEnabledChannels).mockReturnValue(["solr"]);

    await propagateProductEdit("A1", "hidros-it", "vinc-hidros-it");

    expect(vi.mocked(markSolrIndexed)).toHaveBeenCalledWith(expect.anything(), ["A1"]);
    expect(vi.mocked(syncProductToMarketplaces)).not.toHaveBeenCalled();
  });

  it("queues the remaining enabled channels (not Solr) through the marketplace queue", async () => {
    vi.mocked(getEnabledChannels).mockReturnValue(["solr", "b2b", "ebay"]);

    await propagateProductEdit("A1", "hidros-it", "vinc-hidros-it");

    expect(vi.mocked(syncProductToMarketplaces)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(syncProductToMarketplaces)).toHaveBeenCalledWith(
      "A1",
      expect.objectContaining({
        tenantId: "hidros-it",
        channels: ["b2b", "ebay"],
        operation: "update",
      }),
    );
  });
});
