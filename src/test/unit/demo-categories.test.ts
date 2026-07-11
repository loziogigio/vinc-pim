import { describe, it, expect } from "vitest";
import { buildDemoCategories } from "../../../scripts/demo/demo-categories";
import { DEMO_CATEGORIES } from "../../../scripts/demo/demo-catalog";

describe("demo category records", () => {
  const cats = buildDemoCategories();
  it("one record per DEMO_CATEGORIES entry, b2b root, active", () => {
    expect(cats).toHaveLength(DEMO_CATEGORIES.length);
    for (const c of cats) {
      expect(c.category_id).toMatch(/^cat_/);
      expect(c.is_active).toBe(true);
      expect(c.channel_code).toBe("b2b");
      expect(c.level).toBe(0);
      expect(typeof c.name).toBe("string"); // Category.name is a plain string
      expect(c.slug).toBeTruthy();
    }
  });
});
