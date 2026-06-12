import { describe, it, expect } from "vitest";
import {
  loadMenuLanguageContext,
  resolveMenuLanguage,
  isDefaultMenuLanguage,
  menuLanguageFilter,
  withMenuLanguage,
  type MenuLanguageContext,
} from "@/lib/utils/menu-language";

/**
 * Fake Mongoose-style Language model returning a fixed list of docs, so the
 * resolver can be tested without a database.
 */
function fakeLanguageModel(docs: Array<{ code: string; isDefault?: boolean }>) {
  return {
    find: () => ({
      select: () => ({
        lean: async () => docs,
      }),
    }),
  };
}

// A tenant (like Base Protection) whose enabled languages include fr/es/pt,
// none of which are in the static @/config/languages list.
const baseProtectionDocs = [
  { code: "it", isDefault: true },
  { code: "en", isDefault: false },
  { code: "fr", isDefault: false },
  { code: "es", isDefault: false },
  { code: "pt", isDefault: false },
];

async function baseProtectionCtx(): Promise<MenuLanguageContext> {
  return loadMenuLanguageContext(fakeLanguageModel(baseProtectionDocs) as never);
}

describe("menu-language: tenant-driven language resolution", () => {
  it("loads enabled codes and the default from the tenant's Language collection", async () => {
    const ctx = await baseProtectionCtx();
    expect(ctx.enabledCodes).toEqual(["it", "en", "fr", "es", "pt"]);
    expect(ctx.defaultCode).toBe("it");
  });

  it("resolves a tenant language NOT in the static config to itself (the bug)", async () => {
    const ctx = await baseProtectionCtx();
    // The original bug: pt/fr/es collapsed onto the default ("it") because they
    // are absent from the static @/config/languages list.
    expect(resolveMenuLanguage("pt", ctx)).toBe("pt");
    expect(resolveMenuLanguage("fr", ctx)).toBe("fr");
    expect(resolveMenuLanguage("es", ctx)).toBe("es");
  });

  it("still resolves the default and statically-known languages correctly", async () => {
    const ctx = await baseProtectionCtx();
    expect(resolveMenuLanguage("it", ctx)).toBe("it");
    expect(resolveMenuLanguage("en", ctx)).toBe("en");
  });

  it("falls back to the default for unknown / disabled / empty codes", async () => {
    const ctx = await baseProtectionCtx();
    expect(resolveMenuLanguage("de", ctx)).toBe("it"); // not enabled for this tenant
    expect(resolveMenuLanguage("", ctx)).toBe("it");
    expect(resolveMenuLanguage(null, ctx)).toBe("it");
    expect(resolveMenuLanguage(undefined, ctx)).toBe("it");
  });

  it("normalizes case/whitespace", async () => {
    const ctx = await baseProtectionCtx();
    expect(resolveMenuLanguage("  PT  ", ctx)).toBe("pt");
  });

  it("treats each non-default language as its own isolated version", async () => {
    const ctx = await baseProtectionCtx();
    expect(isDefaultMenuLanguage("pt", ctx)).toBe(false);
    expect(menuLanguageFilter("pt", ctx)).toEqual({ language: "pt" });
    expect(withMenuLanguage({ channel: "b2b" }, "pt", ctx)).toEqual({
      $and: [{ channel: "b2b" }, { language: "pt" }],
    });
  });

  it("default version also matches legacy items with no language field", async () => {
    const ctx = await baseProtectionCtx();
    expect(isDefaultMenuLanguage("it", ctx)).toBe(true);
    expect(menuLanguageFilter("it", ctx)).toEqual({
      $or: [
        { language: "it" },
        { language: { $exists: false } },
        { language: null },
      ],
    });
  });

  it("honors a tenant whose default is not Italian", async () => {
    const ctx = await loadMenuLanguageContext(
      fakeLanguageModel([
        { code: "en", isDefault: true },
        { code: "pt", isDefault: false },
      ]) as never,
    );
    expect(ctx.defaultCode).toBe("en");
    expect(resolveMenuLanguage("pt", ctx)).toBe("pt");
    expect(isDefaultMenuLanguage("en", ctx)).toBe(true);
    expect(resolveMenuLanguage("it", ctx)).toBe("en"); // it not enabled → default
  });
});
