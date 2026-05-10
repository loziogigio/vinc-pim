import { describe, it, expect } from "vitest";
import { buildPortalFromHomeSettings } from "@/lib/services/b2b-portal-migration.service";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

describe("buildPortalFromHomeSettings", () => {
  it("produces a portal with slug='default'", () => {
    const portal = buildPortalFromHomeSettings(
      {
        branding: { title: "Acme" },
        headerConfig: { rows: [] },
        meta_tags: {},
      } as any,
      "Acme Corp",
    );
    expect(portal.slug).toBe(DEFAULT_PORTAL_SLUG);
    expect(portal.name).toBe("Acme Corp");
    expect(portal.branding.title).toBe("Acme");
    expect(portal.channel).toBe("default");
    expect(portal.status).toBe("active");
    expect(portal.domains).toEqual([]);
  });

  it("seeds domains from branding.shopUrl when present", () => {
    const portal = buildPortalFromHomeSettings(
      {
        branding: { title: "Acme", shopUrl: "https://shop.acme.com" },
        headerConfig: { rows: [] },
        meta_tags: {},
      } as any,
      "Acme",
    );
    expect(portal.domains).toEqual([
      { domain: "https://shop.acme.com", is_primary: true },
    ]);
  });

  it("returns empty arrays/objects for missing optional fields", () => {
    const portal = buildPortalFromHomeSettings(
      { branding: { title: "X" } } as any,
      "X",
    );
    expect(portal.domains).toEqual([]);
    expect(portal.custom_scripts).toEqual([]);
    expect(portal.header_config_draft).toBeUndefined();
    expect(portal.footer_draft).toBeUndefined();
  });

  it("preserves header_config_draft and footer when headerConfigDraft is present", () => {
    const portal = buildPortalFromHomeSettings(
      {
        branding: { title: "X" },
        headerConfig: { rows: [] },
        headerConfigDraft: { rows: [{ id: "r1", blocks: [] }] },
        footerHtml: "<footer>Published</footer>",
        footerHtmlDraft: "<footer>Draft</footer>",
        meta_tags: {},
      } as any,
      "X",
    );
    expect(portal.header_config_draft).toEqual({ rows: [{ id: "r1", blocks: [] }] });
    expect(portal.footer.footer_html).toBe("<footer>Published</footer>");
    expect(portal.footer_draft).toBeDefined();
    expect(portal.footer_draft!.footer_html_draft).toBe("<footer>Draft</footer>");
  });

  it("maps branding camelCase fields to IB2CStorefrontBranding snake_case fields", () => {
    const portal = buildPortalFromHomeSettings(
      {
        branding: {
          title: "Shop",
          logo: "https://cdn.example.com/logo.png",
          favicon: "https://cdn.example.com/favicon.ico",
          primaryColor: "#ff0000",
          secondaryColor: "#00ff00",
          accentColor: "#0000ff",
        },
      } as any,
      "Shop Inc",
    );
    expect(portal.branding.title).toBe("Shop");
    expect(portal.branding.logo_url).toBe("https://cdn.example.com/logo.png");
    expect(portal.branding.favicon_url).toBe("https://cdn.example.com/favicon.ico");
    expect(portal.branding.primary_color).toBe("#ff0000");
    expect(portal.branding.secondary_color).toBe("#00ff00");
    expect(portal.branding.accent_color).toBe("#0000ff");
  });

  it("maps meta_tags camelCase fields to IB2CStorefrontMetaTags snake_case fields", () => {
    const portal = buildPortalFromHomeSettings(
      {
        branding: { title: "X" },
        meta_tags: {
          title: "SEO Title",
          description: "SEO Description",
          canonicalUrl: "https://shop.example.com",
          ogTitle: "OG Title",
          ogDescription: "OG Desc",
          ogImage: "https://cdn.example.com/og.jpg",
          ogSiteName: "My Shop",
          ogType: "website",
          twitterCard: "summary_large_image",
          twitterSite: "@myshop",
          twitterCreator: "@creator",
          twitterImage: "https://cdn.example.com/tw.jpg",
          themeColor: "#009f7f",
          googleSiteVerification: "abc123",
          bingSiteVerification: "xyz789",
          structuredData: '{"@type":"Organization"}',
        },
      } as any,
      "X",
    );
    expect(portal.meta_tags.title).toBe("SEO Title");
    expect(portal.meta_tags.description).toBe("SEO Description");
    expect(portal.meta_tags.canonical_url).toBe("https://shop.example.com");
    expect(portal.meta_tags.og_title).toBe("OG Title");
    expect(portal.meta_tags.og_description).toBe("OG Desc");
    expect(portal.meta_tags.og_image).toBe("https://cdn.example.com/og.jpg");
    expect(portal.meta_tags.og_site_name).toBe("My Shop");
    expect(portal.meta_tags.og_type).toBe("website");
    expect(portal.meta_tags.twitter_card).toBe("summary_large_image");
    expect(portal.meta_tags.twitter_site).toBe("@myshop");
    expect(portal.meta_tags.twitter_creator).toBe("@creator");
    expect(portal.meta_tags.twitter_image).toBe("https://cdn.example.com/tw.jpg");
    expect(portal.meta_tags.theme_color).toBe("#009f7f");
    expect(portal.meta_tags.google_site_verification).toBe("abc123");
    expect(portal.meta_tags.bing_site_verification).toBe("xyz789");
    expect(portal.meta_tags.structured_data).toBe('{"@type":"Organization"}');
  });

  it("is a pure function (does not mutate input)", () => {
    const input = {
      branding: { title: "A" },
      headerConfig: { rows: [] },
      meta_tags: {},
    };
    const before = JSON.stringify(input);
    buildPortalFromHomeSettings(input as any, "A");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("produces created_at and updated_at Date instances", () => {
    const portal = buildPortalFromHomeSettings(
      { branding: { title: "X" } } as any,
      "X",
    );
    expect(portal.created_at).toBeInstanceOf(Date);
    expect(portal.updated_at).toBeInstanceOf(Date);
  });

  it("header_config defaults to empty rows when headerConfig is missing", () => {
    const portal = buildPortalFromHomeSettings(
      { branding: { title: "X" } } as any,
      "X",
    );
    expect(portal.header_config).toEqual({ rows: [] });
  });

  it("footer.footer_html is undefined when footerHtml is missing", () => {
    const portal = buildPortalFromHomeSettings(
      { branding: { title: "X" } } as any,
      "X",
    );
    expect(portal.footer.footer_html).toBeUndefined();
    expect(portal.footer_draft).toBeUndefined();
  });
});
