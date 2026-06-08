import { describe, it, expect } from "vitest";

import {
  resolveHeaderConfig,
  resolveFooter,
  headerDraftPatch,
  footerPublishPatch,
} from "@/lib/services/portal-section-lang";

const portal = {
  header_config: { rows: [{ id: "base-pub" }] },
  header_config_draft: { rows: [{ id: "base-draft" }] },
  header_config_by_lang: { de: { rows: [{ id: "de-pub" }] } },
  header_config_draft_by_lang: { de: { rows: [{ id: "de-draft" }] } },
  footer: { copyrightText: "base" },
  footer_by_lang: { de: { copyrightText: "de" } },
} as any;

const ALLOWED = ["it", "de", "en"];

describe("resolveHeaderConfig", () => {
  it("returns the default-language base for the default lang", () => {
    expect(resolveHeaderConfig(portal, "it", ALLOWED, "it").rows[0].id).toBe("base-pub");
  });
  it("returns the per-language published version when present", () => {
    expect(resolveHeaderConfig(portal, "de", ALLOWED, "it").rows[0].id).toBe("de-pub");
  });
  it("falls back to base when the language has no version", () => {
    expect(resolveHeaderConfig(portal, "en", ALLOWED, "it").rows[0].id).toBe("base-pub");
  });
  it("falls back to base for an invalid lang", () => {
    expect(resolveHeaderConfig(portal, "zz", ALLOWED, "it").rows[0].id).toBe("base-pub");
  });
  it("reads the draft slot when draft:true", () => {
    expect(resolveHeaderConfig(portal, "de", ALLOWED, "it", { draft: true }).rows[0].id).toBe("de-draft");
  });
});

describe("resolveFooter", () => {
  it("returns per-language footer when present", () => {
    expect(resolveFooter(portal, "de", ALLOWED, "it").copyrightText).toBe("de");
  });
  it("falls back to base footer", () => {
    expect(resolveFooter(portal, "en", ALLOWED, "it").copyrightText).toBe("base");
  });
});

describe("headerDraftPatch", () => {
  it("writes the base field for the default lang", () => {
    expect(headerDraftPatch("it", { rows: [] }, {}, "it")).toEqual({
      header_config_draft: { rows: [] },
    });
  });
  it("writes the by-lang map for a non-default lang, preserving siblings", () => {
    expect(headerDraftPatch("de", { rows: [1] } as any, { en: { rows: [9] } } as any, "it")).toEqual({
      header_config_draft_by_lang: { en: { rows: [9] }, de: { rows: [1] } },
    });
  });
});

describe("footerPublishPatch", () => {
  it("publishes both base slots for the default lang", () => {
    expect(footerPublishPatch("it", { copyrightText: "p" } as any, {}, {}, "it")).toEqual({
      footer: { copyrightText: "p" },
      footer_draft: { copyrightText: "p" },
    });
  });
  it("publishes into both by-lang maps for a non-default lang", () => {
    expect(
      footerPublishPatch("de", { copyrightText: "p" } as any, { en: {} } as any, {}, "it")
    ).toEqual({
      footer_by_lang: { en: {}, de: { copyrightText: "p" } },
      footer_draft_by_lang: { de: { copyrightText: "p" } },
    });
  });
});
