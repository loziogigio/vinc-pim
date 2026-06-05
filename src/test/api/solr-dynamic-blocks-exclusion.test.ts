import { describe, expect, it } from "vitest";
import { SolrAdapter } from "@/lib/adapters/solr-adapter";

/**
 * Guard test for the dynamic_blocks Solr exclusion (spec §4).
 * dynamic_blocks lives only in Mongo and is attached to the storefront response by
 * the gated enrichment step — deliberately NEVER indexed into Solr. transformProduct()
 * is an explicit whitelist (no `...product` spread). This test fails the moment someone
 * adds dynamic_blocks to the whitelist.
 */
function makeAdapter() {
  return new SolrAdapter(
    { custom_config: { solr_url: "http://solr:8983/solr", solr_core: "vinc-test" } },
    "vinc-test"
  );
}

describe("Solr transformProduct excludes dynamic_blocks", () => {
  it("never copies dynamic_blocks onto the Solr document", async () => {
    const adapter = makeAdapter();
    const product = {
      entity_code: "536914",
      sku: "536914",
      name: { it: "Prodotto Brevetti" },
      dynamic_blocks: [
        {
          id: "blk_01", lang: "it", title: "Brevetti", section: 1, order: 0, columns: 2, is_active: true,
          elements: [{ id: "e1", kind: "image", media: { url: "https://cdn.example/patent1.png" } }],
        },
      ],
    };
    const doc = await adapter.transformProduct(product as any);
    expect(Object.prototype.hasOwnProperty.call(doc, "dynamic_blocks")).toBe(false);
    expect((doc as any).dynamic_blocks).toBeUndefined();
    expect(doc.entity_code).toBe("536914");
  });
});
