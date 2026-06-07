import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { B2BPortalSchema } from "@/lib/db/models/b2b-portal";

describe("b2b-portal per-language section fields", () => {
  it("accepts and persists header/footer by-lang maps", () => {
    const Model = mongoose.models.__TestPortal__ ||
      mongoose.model("__TestPortal__", B2BPortalSchema);
    const doc = new Model({
      slug: "default",
      name: "T",
      header_config_by_lang: { de: { rows: [] } },
      header_config_draft_by_lang: { de: { rows: [] } },
      footer_by_lang: { de: { copyright_text: "x" } },
      footer_draft_by_lang: { de: { copyright_text: "x" } },
    });
    expect(doc.header_config_by_lang.get("de")).toBeTruthy();
    expect(doc.footer_draft_by_lang.get("de").copyright_text).toBe("x");
  });
});
