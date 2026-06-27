import { describe, it, expect } from "vitest";
import { validateRecordData } from "@/lib/data-models/validate-record";
import type { DataModelField } from "@/lib/db/models/data-model-definition";

const flag: DataModelField = { slug: "flag", label: "Flag", type: "checkbox" };

describe("unit: validateRecordData checkbox materialization", () => {
  it("materializes an absent checkbox to false on create", () => {
    const out = validateRecordData({}, [flag], { strict: true });
    expect(out.flag).toBe(false);
  });

  it("keeps an explicit false on create", () => {
    const out = validateRecordData({ flag: false }, [flag], { strict: true });
    expect(out.flag).toBe(false);
  });

  it("coerces stringy/numeric booleans", () => {
    expect(validateRecordData({ flag: "true" }, [flag], {}).flag).toBe(true);
    expect(validateRecordData({ flag: 1 }, [flag], {}).flag).toBe(true);
    expect(validateRecordData({ flag: "false" }, [flag], {}).flag).toBe(false);
    expect(validateRecordData({ flag: 0 }, [flag], {}).flag).toBe(false);
  });

  it("does NOT materialize an absent checkbox on partial (PATCH)", () => {
    const out = validateRecordData({}, [flag], { strict: true, partial: true });
    expect("flag" in out).toBe(false);
  });

  it("materializes a nested checkbox inside an object on create", () => {
    const fields: DataModelField[] = [
      { slug: "cfg", label: "Cfg", type: "object", fields: [flag] },
    ];
    const out = validateRecordData({ cfg: {} }, fields, { strict: true });
    expect((out.cfg as Record<string, unknown>).flag).toBe(false);
  });
});

describe("unit: validateRecordData secret fields", () => {
  const apiKey: DataModelField = { slug: "api_key", label: "API key", type: "secret" };

  it("persists a secret value as a string (does not silently drop it)", () => {
    const out = validateRecordData({ api_key: "xsmtpsib-abc123" }, [apiKey], { strict: true });
    expect(out.api_key).toBe("xsmtpsib-abc123");
  });

  it("keeps a secret stored inside a nested object", () => {
    const fields: DataModelField[] = [
      { slug: "cfg", label: "Cfg", type: "object", fields: [apiKey] },
    ];
    const out = validateRecordData({ cfg: { api_key: "s3cr3t" } }, fields, { strict: true });
    expect((out.cfg as Record<string, unknown>).api_key).toBe("s3cr3t");
  });
});
