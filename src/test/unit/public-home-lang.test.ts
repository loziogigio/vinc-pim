import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/languages", () => ({
  getDefaultLanguage: () => ({ code: "it" }),
  isValidLanguageCode: (c: string) => ["it", "de", "en"].includes(c),
}));

const { getPortalBySlug } = vi.hoisted(() => ({ getPortalBySlug: vi.fn() }));
vi.mock("@/lib/services/b2b-portal.service", () => ({ getPortalBySlug }));
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: () => ({ valid: true, tenantId: "t1" }),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: () => ({ HomeTemplate: { findOne: () => ({ lean: () => null }) } }),
}));
// Route calls `getHomeSettings(tenantDb).catch(...)`, so it must return a thenable.
vi.mock("@/lib/db/home-settings", () => ({ getHomeSettings: () => Promise.resolve(null) }));
vi.mock("@/lib/services/tenant-languages", () => ({
  getTenantLanguageCodes: async () => ["it", "de", "en"],
  getTenantDefaultLanguageCode: async () => "it",
}));

import { GET } from "@/app/api/b2b/b2b/public/home/route";

function reqWith(lang?: string) {
  const url = `http://x/api/b2b/b2b/public/home?portal=default${lang ? `&lang=${lang}` : ""}`;
  return new Request(url, {
    headers: { "x-api-key-id": "k", "x-api-secret": "s" },
  }) as any;
}

beforeEach(() => {
  getPortalBySlug.mockResolvedValue({
    slug: "default",
    header_config: { rows: [{ id: "base" }] },
    header_config_by_lang: { de: { rows: [{ id: "de" }] } },
    footer: { copyright_text: "base" },
    footer_by_lang: { de: { copyright_text: "de" } },
  });
});

describe("public/home lang resolution", () => {
  it("returns the de version for ?lang=de", async () => {
    const res = await GET(reqWith("de"));
    const json = await res.json();
    expect(json.portal.header_config.rows[0].id).toBe("de");
    expect(json.portal.footer.copyright_text).toBe("de");
  });
  it("falls back to base for ?lang=en (no override)", async () => {
    const res = await GET(reqWith("en"));
    const json = await res.json();
    expect(json.portal.header_config.rows[0].id).toBe("base");
    expect(json.portal.footer.copyright_text).toBe("base");
  });
});
