import { describe, it, expect } from "vitest";
import { SolrAdapter } from "@/lib/adapters/solr-adapter";

function makeAdapter() {
  return new SolrAdapter({ custom_config: { solr_url: "http://x", solr_core: "vinc-test" } });
}

function baseProduct(attrs: Record<string, any>) {
  return {
    entity_code: "P1",
    sku: "P1",
    status: "active",
    attributes: { it: attrs },
  } as any;
}

describe("SolrAdapter attribute faceting respects hide_in_facets", () => {
  it("EMITS attribute_<slug>_s when hide_in_facets is false/absent", async () => {
    const adapter = makeAdapter();
    const doc: any = await adapter.transformProduct(
      baseProduct({
        colore: { key: "colore", label: "Colore", value: "ROSSO" },
      }),
      { language: "it" }
    );
    expect(doc["attribute_colore_s"]).toBe("ROSSO");
  });

  it("OMITS attribute_<slug>_s when hide_in_facets is true", async () => {
    const adapter = makeAdapter();
    const doc: any = await adapter.transformProduct(
      baseProduct({
        colore: { key: "colore", label: "Colore", value: "ROSSO", hide_in_facets: true },
      }),
      { language: "it" }
    );
    expect(doc["attribute_colore_s"]).toBeUndefined();
  });

  it("4-combination matrix: hide_in_commerce never affects the index; hide_in_facets always does", async () => {
    const adapter = makeAdapter();
    const doc: any = await adapter.transformProduct(
      baseProduct({
        neither: { key: "neither", label: "N", value: "A" },
        commerce: { key: "commerce", label: "C", value: "B", hide_in_commerce: true },
        facets: { key: "facets", label: "F", value: "C", hide_in_facets: true },
        both: { key: "both", label: "Bo", value: "D", hide_in_commerce: true, hide_in_facets: true },
      }),
      { language: "it" }
    );
    // hide_in_commerce alone leaves the facet field present
    expect(doc["attribute_neither_s"]).toBe("A");
    expect(doc["attribute_commerce_s"]).toBe("B");
    // hide_in_facets removes the facet field
    expect(doc["attribute_facets_s"]).toBeUndefined();
    expect(doc["attribute_both_s"]).toBeUndefined();
  });
});

describe("re-index payload fully omits hidden-in-facets attribute fields", () => {
  it("emits no attribute_<slug>_* key for a hide_in_facets attribute (any suffix)", async () => {
    const adapter = new SolrAdapter({ custom_config: { solr_url: "http://x", solr_core: "vinc-test" } });
    const doc: any = await adapter.transformProduct(
      {
        entity_code: "P9",
        sku: "P9",
        status: "active",
        attributes: {
          it: {
            // numeric value would otherwise produce attribute_peso_f
            peso: { key: "peso", label: "Peso", value: 12.5, hide_in_facets: true },
          },
        },
      } as any,
      { language: "it" }
    );
    const hiddenKeys = Object.keys(doc).filter((k) => k.startsWith("attribute_peso_"));
    expect(hiddenKeys).toEqual([]);
  });
});
