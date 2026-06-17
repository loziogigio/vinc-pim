import { describe, it, expect } from "vitest";
import { DEMO_CATEGORIES, DEMO_BRANDS } from "../../../scripts/demo/demo-catalog";

describe("Velia Ferramenta taxonomy", () => {
  it("has the 6 ferramenta categories", () => {
    const codes = DEMO_CATEGORIES.map((c) => c.code).sort();
    expect(codes).toEqual(
      ["abrasivi", "dpi", "elettrico", "fissaggi", "utensili-elettrici", "utensili-mano"].sort()
    );
    for (const c of DEMO_CATEGORIES) {
      expect(c.name.it).toBeTruthy();
      expect(c.name.en).toBeTruthy();
    }
  });

  it("uses fictional hardware brands only (no real brand names)", () => {
    const labels = DEMO_BRANDS.map((b) => b.label);
    expect(labels).toContain("Forgia");
    expect(DEMO_BRANDS.length).toBeGreaterThanOrEqual(6);
    const banned = ["Bosch", "Makita", "DeWalt", "Würth", "Fischer", "Stanley", "Hilti"];
    for (const b of labels) expect(banned).not.toContain(b);
  });
});
