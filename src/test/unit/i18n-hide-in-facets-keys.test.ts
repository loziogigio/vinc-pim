import { describe, it, expect } from "vitest";
import { createT } from "@/lib/i18n";

describe("hide_in_facets tooltip i18n keys", () => {
  for (const locale of ["en", "it", "sk"] as const) {
    it(`${locale} resolves the facet toggle tooltip keys`, () => {
      const t = createT(locale);
      const hidden = t("pages.pim.attributes.editor.hiddenInFacets");
      const visible = t("pages.pim.attributes.editor.visibleInFacets");
      expect(hidden).not.toBe("pages.pim.attributes.editor.hiddenInFacets");
      expect(visible).not.toBe("pages.pim.attributes.editor.visibleInFacets");
      expect(hidden.length).toBeGreaterThan(0);
      expect(visible.length).toBeGreaterThan(0);
    });
  }

  // Force REAL per-locale keys (not just an English fallback): createT falls back to
  // en.ts when a key is missing in it.ts/sk.ts, so equal strings across locales would
  // hide a missing it/sk key. The three translations are intentionally distinct.
  it("it and sk have their own (non-English) facet tooltip strings", () => {
    const en = createT("en");
    const it = createT("it");
    const sk = createT("sk");
    expect(it("pages.pim.attributes.editor.hiddenInFacets")).not.toBe(
      en("pages.pim.attributes.editor.hiddenInFacets")
    );
    expect(sk("pages.pim.attributes.editor.hiddenInFacets")).not.toBe(
      en("pages.pim.attributes.editor.hiddenInFacets")
    );
    expect(it("pages.pim.attributes.editor.visibleInFacets")).not.toBe(
      en("pages.pim.attributes.editor.visibleInFacets")
    );
    expect(sk("pages.pim.attributes.editor.visibleInFacets")).not.toBe(
      en("pages.pim.attributes.editor.visibleInFacets")
    );
  });
});
