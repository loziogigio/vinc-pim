import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { PIMProductSchema } from "@/lib/db/models/pim-product";

describe("unit: pim-product is_public subdoc defaults", () => {
  it("media subdoc declares is_public Boolean default true", () => {
    const mediaPath: any = PIMProductSchema.path("media");
    const isPublic = mediaPath.schema.path("is_public");
    expect(isPublic).toBeDefined();
    expect(isPublic.instance).toBe("Boolean");
    expect(isPublic.defaultValue).toBe(true);
  });

  it("dynamic_blocks element subdoc declares is_public Boolean default true", () => {
    const blocksPath: any = PIMProductSchema.path("dynamic_blocks");
    const elementsPath: any = blocksPath.schema.path("elements");
    const isPublic = elementsPath.schema.path("is_public");
    expect(isPublic).toBeDefined();
    expect(isPublic.instance).toBe("Boolean");
    expect(isPublic.defaultValue).toBe(true);
  });

  it("a constructed media item defaults is_public to true", () => {
    const Model = mongoose.models.__IsPublicProbe ||
      mongoose.model("__IsPublicProbe", PIMProductSchema);
    const doc: any = new Model({
      entity_code: "E1", sku: "S1",
      media: [{ type: "document", url: "https://x/y.pdf", position: 0 }],
    });
    expect(doc.media[0].is_public).toBe(true);
  });
});
