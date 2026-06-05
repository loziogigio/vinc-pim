import { describe, it, expect } from "vitest";
import type { SearchRequest, SolrProduct } from "@/lib/types/search";
import type { DynamicBlock } from "@/lib/types/dynamic-blocks";

describe("unit: search types carry dynamic_blocks", () => {
  it("SearchRequest accepts include_dynamic_blocks flag", () => {
    const req: SearchRequest = { lang: "it", include_dynamic_blocks: true };
    expect(req.include_dynamic_blocks).toBe(true);
  });
  it("SolrProduct accepts a typed dynamic_blocks array", () => {
    const block: DynamicBlock = { id: "blk_01", lang: "it", section: 1, order: 0, columns: 2, is_active: true, elements: [{ id: "e1", kind: "text", text: "hi" }] };
    const p: SolrProduct = { id: "1", sku: "S1", entity_code: "E1", name: "n", slug: "s", dynamic_blocks: [block] };
    expect(p.dynamic_blocks?.[0].section).toBe(1);
  });
});
