import { describe, expect, it } from "vitest";
import { PIMProductSchema } from "@/lib/db/models/pim-product";

describe("PIMProduct solr_indexed_at", () => {
  it("declares a top-level solr_indexed_at Date path", () => {
    const path = PIMProductSchema.paths["solr_indexed_at"];
    expect(path).toBeDefined();
    expect(path.instance).toBe("Date");
  });

  it("has an index supporting the needs-indexing query", () => {
    const indexes = PIMProductSchema.indexes();
    const idx = indexes.find(
      ([fields]) =>
        "isCurrent" in fields && "status" in fields && "solr_indexed_at" in fields
    );
    expect(idx).toBeDefined();
  });
});
