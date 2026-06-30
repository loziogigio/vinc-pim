import { describe, it, expect } from "vitest";
import { CATALOG_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/catalog-settings";
import { validateFieldsTree, findExternalRefField } from "@/lib/db/models/data-model-definition";

describe("catalog_settings user_exclusion_rules field", () => {
  const fields = CATALOG_SETTINGS_BLUEPRINT.definition.fields;
  const rules = fields.find((f) => f.slug === "user_exclusion_rules");

  it("defines a repeatable array_of_objects field", () => {
    expect(rules).toBeDefined();
    expect(rules!.type).toBe("array_of_objects");
    expect(Array.isArray(rules!.fields)).toBe(true);
  });

  it("has the four nested rule sub-fields with correct types", () => {
    const sub = Object.fromEntries((rules!.fields ?? []).map((f) => [f.slug, f]));
    expect(sub.enabled.type).toBe("checkbox");
    expect(sub.user_field.type).toBe("select");
    expect(sub.user_field.options?.map((o) => o.value)).toContain("address_country");
    expect(sub.solr_field.type).toBe("text");
    expect(sub.label.type).toBe("text");
  });

  it("passes the framework field-tree validator", () => {
    expect(() => validateFieldsTree(fields)).not.toThrow();
    // no is_external_ref on a single-cardinality config model
    expect(findExternalRefField(fields)).toBeUndefined();
  });

  it("seeds an empty rules array by default", () => {
    expect(CATALOG_SETTINGS_BLUEPRINT.defaultRecord.data.user_exclusion_rules).toEqual([]);
  });
});
