import { describe, it, expect } from "vitest";
import { buildDiscoveredFacetFields } from "@/lib/search/facet-discovery";

const lukeFields = {
  id: { type: "string" },
  attribute_is_new_b: { type: "boolean" },
  spec_color_s: { type: "strings" },
  spec_weight_f: { type: "pfloat" },
  spec_labels_color_s: { type: "string" }, // must be excluded
  name_text_it: { type: "text_general" }, // not a facet field
};

describe("buildDiscoveredFacetFields", () => {
  it("includes static fields with their known labels/types", () => {
    const out = buildDiscoveredFacetFields({});
    const brand = out.find((f) => f.field === "brand_id");
    expect(brand).toMatchObject({ label: "Marca", type: "flat", source: "static" });
    const category = out.find((f) => f.field === "category_ancestors");
    expect(category?.type).toBe("hierarchical");
  });

  it("adds dynamic attribute_* and spec_* fields from Luke", () => {
    const out = buildDiscoveredFacetFields(lukeFields);
    expect(out.find((f) => f.field === "spec_color_s")).toMatchObject({
      source: "spec",
      type: "flat",
    });
    expect(out.find((f) => f.field === "attribute_is_new_b")).toMatchObject({
      source: "static", // attribute_is_new_b is in FACET_FIELDS_CONFIG → static wins
    });
  });

  it("excludes spec_labels_* and non-facet text fields", () => {
    const out = buildDiscoveredFacetFields(lukeFields);
    expect(out.find((f) => f.field === "spec_labels_color_s")).toBeUndefined();
    expect(out.find((f) => f.field === "name_text_it")).toBeUndefined();
    expect(out.find((f) => f.field === "id")).toBeUndefined();
  });

  it("does not duplicate a field present in both static and dynamic sources", () => {
    const out = buildDiscoveredFacetFields({ attribute_is_new_b: { type: "boolean" } });
    const matches = out.filter((f) => f.field === "attribute_is_new_b");
    expect(matches).toHaveLength(1);
  });
});
