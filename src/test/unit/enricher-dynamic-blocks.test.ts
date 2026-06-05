import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DynamicBlock } from "@/lib/types/dynamic-blocks";

const BLOCK: DynamicBlock = { id: "blk_01", lang: "it", title: "Brevetti", section: 1, order: 0, columns: 2, is_active: true, elements: [{ id: "e1", kind: "text", text: "Descrizione 1" }] };
const PRODUCT_ROW = { entity_code: "E1", sku: "S1", name: { it: "Prodotto" }, isCurrent: true, dynamic_blocks: [BLOCK] };

function makeDb() {
  return {
    collection: (name: string) => {
      const docs = name === "pimproducts" ? [PRODUCT_ROW] : [];
      const cursor: any = { project: () => cursor, sort: () => cursor, limit: () => cursor, toArray: async () => docs };
      return { find: () => cursor };
    },
  };
}
vi.mock("@/lib/db/connection-pool", () => ({ getPooledConnection: vi.fn(async () => ({ db: makeDb() })) }));

const { enrichSearchResults, enrichVariantGroupedResults, loadProductData } = await import("@/lib/search/response-enricher");
const TENANT = "vinc-blocks-test";
beforeEach(() => { vi.clearAllMocks(); });

describe("unit: enricher gates dynamic_blocks behind include_dynamic_blocks", () => {
  it("loadProductData omits dynamic_blocks by default", async () => {
    const map = await loadProductData(TENANT, ["E1"]);
    expect(map.get("E1")?.dynamic_blocks).toBeUndefined();
  });
  it("loadProductData includes dynamic_blocks when flagged", async () => {
    const map = await loadProductData(TENANT, ["E1"], { include_dynamic_blocks: true });
    expect(map.get("E1")?.dynamic_blocks).toEqual([BLOCK]);
  });
  it("standard path: no blocks without the flag", async () => {
    const out = await enrichSearchResults(TENANT, [{ entity_code: "E1" }], "it");
    expect(out[0].dynamic_blocks).toBeUndefined();
  });
  it("standard path: attaches blocks with the flag", async () => {
    const out = await enrichSearchResults(TENANT, [{ entity_code: "E1" }], "it", undefined, { include_dynamic_blocks: true });
    expect(out[0].dynamic_blocks).toEqual([BLOCK]);
  });
  it("variant path: no blocks without the flag", async () => {
    const out = await enrichVariantGroupedResults(TENANT, [{ entity_code: "E1", variants: [] }], "it");
    expect(out[0].dynamic_blocks).toBeUndefined();
  });
  it("variant path: attaches blocks with the flag", async () => {
    const out = await enrichVariantGroupedResults(TENANT, [{ entity_code: "E1", variants: [] }], "it", undefined, { include_dynamic_blocks: true });
    expect(out[0].dynamic_blocks).toEqual([BLOCK]);
  });
});
