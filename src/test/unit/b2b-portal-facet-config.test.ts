import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { B2BPortalSchema } from "@/lib/db/models/b2b-portal";

describe("B2BPortal facet_config schema", () => {
  const Model =
    mongoose.models.B2BPortal || mongoose.model("B2BPortal", B2BPortalSchema);

  it("defines a facet_config path with entries array", () => {
    const path = B2BPortalSchema.path("facet_config");
    expect(path).toBeDefined();
  });

  it("validates an entry shape (field + visible)", () => {
    const doc: any = {
      slug: "default",
      name: "Default",
      channel: "b2b",
      facet_config: { entries: [{ field: "brand_id", visible: true }] },
    };
    const instance = new Model(doc);
    const err = instance.validateSync();
    expect(err?.errors?.["facet_config"]).toBeUndefined();
    expect(instance.facet_config.entries[0].field).toBe("brand_id");
    expect(instance.facet_config.entries[0].visible).toBe(true);
  });

  it("requires field on an entry — missing field triggers a validation error", () => {
    const doc: any = {
      slug: "default",
      name: "Default",
      channel: "b2b",
      facet_config: { entries: [{ visible: true }] },
    };
    const instance = new Model(doc);
    const err = instance.validateSync();
    expect(err).toBeTruthy();
    const errorKeys = Object.keys(err!.errors);
    expect(errorKeys.some((k) => k.includes("field"))).toBe(true);
  });

  it("visible defaults to true when omitted", () => {
    const doc: any = {
      slug: "default",
      name: "Default",
      channel: "b2b",
      facet_config: { entries: [{ field: "brand_id" }] },
    };
    const instance = new Model(doc);
    expect(instance.facet_config.entries[0].visible).toBe(true);
  });
});
