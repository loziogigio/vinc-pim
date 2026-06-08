import { describe, it, expect, vi, beforeEach } from "vitest";

const find = vi.fn();
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    Language: { find: (...a: any[]) => find(...a) },
  })),
}));

import {
  getTenantLanguageCodes,
  getTenantDefaultLanguageCode,
  clearTenantLanguageCache,
} from "@/lib/services/tenant-languages";

function lean(docs: any[]) {
  return { sort: () => ({ lean: async () => docs }) };
}

beforeEach(() => {
  find.mockReset();
  clearTenantLanguageCache();
});

describe("getTenantLanguageCodes", () => {
  it("returns enabled codes for the tenant", async () => {
    find.mockReturnValue(lean([{ code: "it", isDefault: true }, { code: "fr" }, { code: "pt" }]));
    expect(await getTenantLanguageCodes("vinc-base")).toEqual(["it", "fr", "pt"]);
  });
  it("caches per tenant (one DB read for repeated calls)", async () => {
    find.mockReturnValue(lean([{ code: "it", isDefault: true }]));
    await getTenantLanguageCodes("vinc-a");
    await getTenantLanguageCodes("vinc-a");
    expect(find).toHaveBeenCalledTimes(1);
  });
  it("isolates tenants", async () => {
    find.mockReturnValueOnce(lean([{ code: "it", isDefault: true }, { code: "fr" }]))
        .mockReturnValueOnce(lean([{ code: "it", isDefault: true }, { code: "de" }]));
    expect(await getTenantLanguageCodes("vinc-a")).toEqual(["it", "fr"]);
    expect(await getTenantLanguageCodes("vinc-b")).toEqual(["it", "de"]);
  });
  it("empty collection → [default] then ultimate 'it'", async () => {
    find.mockReturnValue(lean([]));
    expect(await getTenantLanguageCodes("vinc-empty")).toEqual(["it"]);
  });
});

describe("getTenantDefaultLanguageCode", () => {
  it("returns the isDefault code", async () => {
    find.mockReturnValue(lean([{ code: "en" }, { code: "fr", isDefault: true }]));
    expect(await getTenantDefaultLanguageCode("vinc-x")).toBe("fr");
  });
  it("falls back to first enabled, then 'it'", async () => {
    find.mockReturnValue(lean([{ code: "es" }, { code: "pt" }]));
    expect(await getTenantDefaultLanguageCode("vinc-y")).toBe("es");
    clearTenantLanguageCache();
    find.mockReturnValue(lean([]));
    expect(await getTenantDefaultLanguageCode("vinc-z")).toBe("it");
  });
});
