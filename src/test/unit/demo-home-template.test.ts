import { describe, it, expect } from "vitest";
import { CANONICAL_HOME_BLOCKS } from "../../../scripts/demo/demo-home-template";

describe("canonical demo home blocks", () => {
  it("has hero, featured slider, category shortcuts, promo band in order", () => {
    const types = CANONICAL_HOME_BLOCKS.map((b) => b.type);
    expect(types).toEqual(["hero", "featured-products", "category-grid", "promo-banner"]);
    CANONICAL_HOME_BLOCKS.forEach((b, i) => {
      expect(b.id).toBeTruthy();
      expect(b.order).toBe(i);
      expect(typeof b.config).toBe("object");
    });
  });
});
