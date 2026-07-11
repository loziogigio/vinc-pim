import { describe, it, expect } from "vitest";
import {
  extractAttributesForLanguage,
  mergeAttributesToMultilingual,
} from "@/lib/types/pim";

describe("hide_in_facets type round-trip", () => {
  it("extractAttributesForLanguage preserves hide_in_facets from multilingual structure", () => {
    const multilingual = {
      it: {
        colore: { key: "colore", label: "Colore", value: "ROSSO", hide_in_facets: true },
        materiale: { key: "materiale", label: "Materiale", value: "COTONE", hide_in_facets: false },
      },
    };
    const flat = extractAttributesForLanguage(multilingual, "it");
    expect(flat.colore.hide_in_facets).toBe(true);
    expect(flat.materiale.hide_in_facets).toBe(false);
  });

  it("mergeAttributesToMultilingual preserves hide_in_facets back into multilingual structure", () => {
    const flat = {
      colore: { label: "Colore", value: "ROSSO", hide_in_facets: true },
      materiale: { label: "Materiale", value: "COTONE", hide_in_facets: false },
    };
    const multilingual = mergeAttributesToMultilingual(flat, undefined, "it");
    expect(multilingual.it.colore.hide_in_facets).toBe(true);
    expect(multilingual.it.materiale.hide_in_facets).toBe(false);
  });

  it("round-trips hide_in_facets through merge then extract", () => {
    const flat = {
      colore: { label: "Colore", value: "ROSSO", hide_in_facets: true },
    };
    const multilingual = mergeAttributesToMultilingual(flat, undefined, "it");
    const backToFlat = extractAttributesForLanguage(multilingual, "it");
    expect(backToFlat.colore.hide_in_facets).toBe(true);
  });

  it("keeps hide_in_commerce and hide_in_facets independent through round-trip", () => {
    const flat = {
      a: { label: "A", value: "1", hide_in_commerce: true, hide_in_facets: false },
      b: { label: "B", value: "2", hide_in_commerce: false, hide_in_facets: true },
    };
    const m = mergeAttributesToMultilingual(flat, undefined, "it");
    expect(m.it.a.hide_in_commerce).toBe(true);
    expect(m.it.a.hide_in_facets).toBe(false);
    expect(m.it.b.hide_in_commerce).toBe(false);
    expect(m.it.b.hide_in_facets).toBe(true);
  });
});
