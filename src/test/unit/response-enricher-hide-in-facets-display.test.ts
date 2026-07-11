import { describe, it, expect } from "vitest";
import {
  getLocalizedAttributes,
  filterVisibleAttributes,
} from "@/lib/search/response-enricher";

// Mirrors the real display pipeline used in enrichSearchResults:
//   filterVisibleAttributes(getLocalizedAttributes(productData.attributes, lang))
function displayAttributes(docAttributes: any, lang: string) {
  return filterVisibleAttributes(getLocalizedAttributes(docAttributes, lang));
}

describe("display attributes are derived from the Mongo doc, not the Solr facet field", () => {
  const docAttributes = {
    it: {
      colore: { key: "colore", label: "Colore", value: "ROSSO", hide_in_facets: true },
      materiale: { key: "materiale", label: "Materiale", value: "COTONE", hide_in_commerce: true },
      taglia: { key: "taglia", label: "Taglia", value: "M" },
    },
  };

  it("keeps a hide_in_facets attribute visible in the display payload", () => {
    const display = displayAttributes(docAttributes, "it");
    expect(display.colore).toBeDefined();
    expect(display.colore.value).toBe("ROSSO");
  });

  it("strips the internal hide_in_facets flag from the visible attribute object", () => {
    const display = displayAttributes(docAttributes, "it");
    // attribute stays visible, but the internal PIM flag must not leak to the client
    expect("hide_in_facets" in display.colore).toBe(false);
  });

  it("still strips hide_in_commerce attributes from the display payload", () => {
    const display = displayAttributes(docAttributes, "it");
    expect(display.materiale).toBeUndefined();
  });

  it("keeps plain attributes visible", () => {
    const display = displayAttributes(docAttributes, "it");
    expect(display.taglia.value).toBe("M");
  });
});
