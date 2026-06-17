import { describe, it, expect } from "vitest";
import { DEMO_CATEGORIES, DEMO_BRANDS, buildDemoCatalog, DEMO_CATALOG_SIZE } from "../../../scripts/demo/demo-catalog";
import { DEMO_TAG_PREMIUM, DEMO_TAG_STANDARD } from "../../../scripts/demo/demo-pricing";

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

describe("Velia Ferramenta catalog", () => {
  const products = buildDemoCatalog(new Date("2026-01-01T00:00:00Z"));

  it("ships 60 SKUs and DEMO_CATALOG_SIZE matches", () => {
    expect(products.length).toBe(60);
    expect(products.length).toBe(DEMO_CATALOG_SIZE);
  });

  it("every SKU references a real category & brand and has IT/EN names + specs", () => {
    const cats = new Set(DEMO_CATEGORIES.map((c) => c.code));
    const brands = new Set(DEMO_BRANDS.map((b) => b.code));
    for (const p of products) {
      expect(cats.has(p.category.slug.it)).toBe(true);
      expect(brands.has(p.brand.slug)).toBe(true);
      expect(p.name.it && p.name.en).toBeTruthy();
      expect(p.technical_specifications.it.length).toBeGreaterThan(0);
      expect(p.entity_code.startsWith("DEMO-")).toBe(true);
    }
  });

  it("spreads exactly 10 SKUs across all 6 categories", () => {
    const byCat = new Map<string, number>();
    for (const p of products) byCat.set(p.category.slug.it, (byCat.get(p.category.slug.it) ?? 0) + 1);
    for (const c of DEMO_CATEGORIES) expect(byCat.get(c.code) ?? 0).toBe(10);
  });
});

describe("demo product images", () => {
  const products = buildDemoCatalog(new Date("2026-01-01T00:00:00Z"));
  it("uses the CDN manifest with the DEMO- prefix, never picsum", () => {
    for (const p of products) {
      const code = p.entity_code.replace(/^DEMO-/, "");
      expect(p.images[0].url).not.toContain("picsum.photos");
      expect(p.images[0].url).toContain(`/demo/DEMO-${code}.jpg`);
      expect(p.images[0].cdn_key).toBe(`demo/DEMO-${code}.jpg`);
    }
  });
});

describe("per-persona pricing tiers", () => {
  const products = buildDemoCatalog(new Date("2026-01-01T00:00:00Z"));
  it("every SKU has a premium and a standard tier", () => {
    for (const p of products) {
      const tags = p.packaging_options.flatMap((o: any) => o.pricing?.tag_filter ?? []);
      expect(tags).toContain(DEMO_TAG_PREMIUM);
      expect(tags).toContain(DEMO_TAG_STANDARD);
    }
  });
  it("has exactly one is_default option in the raw doc (fix H)", () => {
    for (const p of products) {
      const defaults = p.packaging_options.filter((o: any) => o.is_default === true);
      expect(defaults.length).toBe(1);
    }
  });
});
