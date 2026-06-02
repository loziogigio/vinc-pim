import { describe, it, expect } from "vitest";
import { ERP_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/erp-settings";
import { getBlueprint } from "@/lib/data-models/blueprints";
import {
  validateFieldsTree,
  findExternalRefField,
} from "@/lib/db/models/data-model-definition";
import { validateRecordData } from "@/lib/data-models/validate-record";

describe("ERP_SETTINGS_BLUEPRINT", () => {
  const { definition, defaultRecord } = ERP_SETTINGS_BLUEPRINT;

  it("has a valid fields tree", () => {
    expect(() => validateFieldsTree(definition.fields)).not.toThrow();
  });

  it("has no external_ref field (single cardinality)", () => {
    expect(findExternalRefField(definition.fields)).toBeUndefined();
  });

  it("targets the erp_settings slug, single cardinality, server-only", () => {
    expect(definition.slug).toBe("erp_settings");
    expect(definition.cardinality).toBe("single");
    expect(definition.readable_by_end_user).toBe(false);
  });

  it("default _global record validates against its own fields", () => {
    expect(defaultRecord).toBeDefined();
    expect(defaultRecord!.relationId).toBe("_global");
    expect(() =>
      validateRecordData(defaultRecord!.data, definition.fields, { strict: true })
    ).not.toThrow();
  });

  it("is resolvable from the registry by id", () => {
    expect(getBlueprint("erp_settings")).toBe(ERP_SETTINGS_BLUEPRINT);
    expect(getBlueprint("nope")).toBeUndefined();
  });
});
