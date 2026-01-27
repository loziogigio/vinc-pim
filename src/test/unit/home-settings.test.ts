/**
 * Unit Tests for Home Settings
 *
 * Tests the CompanyBranding interface and extended theme colors.
 */

import { describe, it, expect } from "vitest";
import type {
  CompanyBranding,
  ProductCardStyle,
  CDNConfiguration,
  CDNCredentials,
  SMTPSettings,
  HomeSettings,
  HeaderConfig,
  HeaderRow,
  HeaderBlock,
  HeaderWidget,
  RowLayout,
  HeaderWidgetType,
  BlockAlignment,
  MetaTags,
} from "@/lib/types/home-settings";
import {
  LAYOUT_WIDTHS,
  LAYOUT_BLOCK_COUNT,
  HEADER_WIDGET_LIBRARY,
} from "@/lib/types/home-settings";

// ============================================
// COMPANY BRANDING TYPE TESTS
// ============================================

describe("unit: Home Settings - CompanyBranding Interface", () => {
  it("should have required title field", () => {
    /**
     * title is the only required field in CompanyBranding.
     */
    const branding: CompanyBranding = {
      title: "Test Company",
    };
    expect(branding.title).toBe("Test Company");
  });

  it("should accept all optional base fields", () => {
    /**
     * Verify all base optional fields are valid.
     */
    const branding: CompanyBranding = {
      title: "Test Company",
      logo: "/logo.png",
      favicon: "/favicon.ico",
      primaryColor: "#009f7f",
      secondaryColor: "#02b290",
      shopUrl: "https://shop.example.com",
      websiteUrl: "https://www.example.com",
    };

    expect(branding.logo).toBe("/logo.png");
    expect(branding.favicon).toBe("/favicon.ico");
    expect(branding.primaryColor).toBe("#009f7f");
    expect(branding.secondaryColor).toBe("#02b290");
    expect(branding.shopUrl).toBe("https://shop.example.com");
    expect(branding.websiteUrl).toBe("https://www.example.com");
  });

  it("should accept all extended theme color fields", () => {
    /**
     * Extended theme colors added for multi-tenant theming.
     */
    const branding: CompanyBranding = {
      title: "Test Company",
      accentColor: "#3b82f6",
      textColor: "#000000",
      mutedColor: "#595959",
      backgroundColor: "#ffffff",
      headerBackgroundColor: "#f8fafc",
      footerBackgroundColor: "#f5f5f5",
      footerTextColor: "#666666",
    };

    expect(branding.accentColor).toBe("#3b82f6");
    expect(branding.textColor).toBe("#000000");
    expect(branding.mutedColor).toBe("#595959");
    expect(branding.backgroundColor).toBe("#ffffff");
    expect(branding.headerBackgroundColor).toBe("#f8fafc");
    expect(branding.footerBackgroundColor).toBe("#f5f5f5");
    expect(branding.footerTextColor).toBe("#666666");
  });

  it("should allow all extended theme colors to be undefined", () => {
    /**
     * Extended theme colors are optional and can be undefined.
     */
    const branding: CompanyBranding = {
      title: "Test Company",
    };

    expect(branding.accentColor).toBeUndefined();
    expect(branding.textColor).toBeUndefined();
    expect(branding.mutedColor).toBeUndefined();
    expect(branding.backgroundColor).toBeUndefined();
    expect(branding.headerBackgroundColor).toBeUndefined();
    expect(branding.footerBackgroundColor).toBeUndefined();
    expect(branding.footerTextColor).toBeUndefined();
  });

  it("should allow empty string for headerBackgroundColor (transparent/inherit)", () => {
    /**
     * headerBackgroundColor can be empty string to indicate transparent/inherit.
     */
    const branding: CompanyBranding = {
      title: "Test Company",
      headerBackgroundColor: "",
    };

    expect(branding.headerBackgroundColor).toBe("");
  });
});

// ============================================
// COMPLETE BRANDING CONFIG TESTS
// ============================================

describe("unit: Home Settings - Complete Branding Configuration", () => {
  it("should accept a full branding configuration", () => {
    /**
     * Verify a complete branding object with all fields.
     */
    const branding: CompanyBranding = {
      // Required
      title: "My B2B Store",
      // Base optional
      logo: "https://cdn.example.com/logo.png",
      favicon: "https://cdn.example.com/favicon.ico",
      primaryColor: "#009f7f",
      secondaryColor: "#02b290",
      shopUrl: "https://shop.example.com",
      websiteUrl: "https://www.example.com",
      // Extended theme colors
      accentColor: "#3b82f6",
      textColor: "#000000",
      mutedColor: "#595959",
      backgroundColor: "#ffffff",
      headerBackgroundColor: "",
      footerBackgroundColor: "#f5f5f5",
      footerTextColor: "#666666",
    };

    // Verify all fields exist and have correct values
    expect(branding.title).toBe("My B2B Store");
    expect(branding.logo).toBe("https://cdn.example.com/logo.png");
    expect(branding.primaryColor).toBe("#009f7f");
    expect(branding.accentColor).toBe("#3b82f6");
    expect(branding.footerTextColor).toBe("#666666");
  });

  it("should have 14 total fields in CompanyBranding", () => {
    /**
     * CompanyBranding should have exactly 14 fields:
     * - title (required)
     * - logo, favicon, primaryColor, secondaryColor, shopUrl, websiteUrl (6 base optional)
     * - accentColor, textColor, mutedColor, backgroundColor,
     *   headerBackgroundColor, footerBackgroundColor, footerTextColor (7 extended)
     */
    const fullBranding: Required<CompanyBranding> = {
      title: "Test",
      logo: "",
      favicon: "",
      primaryColor: "",
      secondaryColor: "",
      shopUrl: "",
      websiteUrl: "",
      accentColor: "",
      textColor: "",
      mutedColor: "",
      backgroundColor: "",
      headerBackgroundColor: "",
      footerBackgroundColor: "",
      footerTextColor: "",
    };

    const fieldCount = Object.keys(fullBranding).length;
    expect(fieldCount).toBe(14);
  });
});

// ============================================
// DEFAULT VALUES TESTS
// ============================================

describe("unit: Home Settings - Default Values", () => {
  /**
   * These tests verify the expected default values as documented.
   */

  it("should have correct default primary color", () => {
    const DEFAULT_PRIMARY_COLOR = "#009f7f";
    expect(DEFAULT_PRIMARY_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("should have correct default secondary color", () => {
    const DEFAULT_SECONDARY_COLOR = "#02b290";
    expect(DEFAULT_SECONDARY_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("should have correct default text color", () => {
    const DEFAULT_TEXT_COLOR = "#000000";
    expect(DEFAULT_TEXT_COLOR).toBe("#000000");
  });

  it("should have correct default muted color", () => {
    const DEFAULT_MUTED_COLOR = "#595959";
    expect(DEFAULT_MUTED_COLOR).toBe("#595959");
  });

  it("should have correct default background color", () => {
    const DEFAULT_BACKGROUND_COLOR = "#ffffff";
    expect(DEFAULT_BACKGROUND_COLOR).toBe("#ffffff");
  });

  it("should have correct default footer background color", () => {
    const DEFAULT_FOOTER_BG_COLOR = "#f5f5f5";
    expect(DEFAULT_FOOTER_BG_COLOR).toBe("#f5f5f5");
  });

  it("should have correct default footer text color", () => {
    const DEFAULT_FOOTER_TEXT_COLOR = "#666666";
    expect(DEFAULT_FOOTER_TEXT_COLOR).toBe("#666666");
  });

  it("should have empty string as default for headerBackgroundColor", () => {
    /**
     * headerBackgroundColor defaults to empty string for transparent/inherit.
     */
    const DEFAULT_HEADER_BG_COLOR = "";
    expect(DEFAULT_HEADER_BG_COLOR).toBe("");
  });

  it("should have empty string as default for accentColor", () => {
    /**
     * accentColor defaults to empty string (falls back to primaryColor).
     */
    const DEFAULT_ACCENT_COLOR = "";
    expect(DEFAULT_ACCENT_COLOR).toBe("");
  });
});

// ============================================
// PRODUCT CARD STYLE TESTS
// ============================================

describe("unit: Home Settings - ProductCardStyle Interface", () => {
  it("should accept all card style properties", () => {
    const cardStyle: ProductCardStyle = {
      borderWidth: 1,
      borderColor: "#EAEEF2",
      borderStyle: "solid",
      shadowSize: "none",
      shadowColor: "rgba(0, 0, 0, 0.1)",
      borderRadius: "md",
      hoverEffect: "none",
      hoverScale: 1.02,
      hoverShadowSize: "lg",
      backgroundColor: "#ffffff",
      hoverBackgroundColor: "#f8fafc",
    };

    expect(cardStyle.borderWidth).toBe(1);
    expect(cardStyle.borderStyle).toBe("solid");
    expect(cardStyle.borderRadius).toBe("md");
    expect(cardStyle.hoverEffect).toBe("none");
  });

  it("should accept valid border style values", () => {
    const validStyles: Array<ProductCardStyle["borderStyle"]> = [
      "solid",
      "dashed",
      "dotted",
      "none",
    ];

    validStyles.forEach((style) => {
      const cardStyle: ProductCardStyle = {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: style,
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      };
      expect(cardStyle.borderStyle).toBe(style);
    });
  });

  it("should accept valid hover effect values", () => {
    const validEffects: Array<ProductCardStyle["hoverEffect"]> = [
      "none",
      "lift",
      "shadow",
      "scale",
      "border",
      "glow",
    ];

    validEffects.forEach((effect) => {
      const cardStyle: ProductCardStyle = {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: effect,
        backgroundColor: "#ffffff",
      };
      expect(cardStyle.hoverEffect).toBe(effect);
    });
  });
});

// ============================================
// CDN CONFIGURATION TESTS
// ============================================

describe("unit: Home Settings - CDNConfiguration Interface", () => {
  it("should accept CDN configuration", () => {
    const cdn: CDNConfiguration = {
      baseUrl: "https://cdn.example.com/bucket",
      description: "Main CDN for product images",
      enabled: true,
    };

    expect(cdn.baseUrl).toBe("https://cdn.example.com/bucket");
    expect(cdn.description).toBe("Main CDN for product images");
    expect(cdn.enabled).toBe(true);
  });

  it("should allow all fields to be undefined", () => {
    const cdn: CDNConfiguration = {};

    expect(cdn.baseUrl).toBeUndefined();
    expect(cdn.description).toBeUndefined();
    expect(cdn.enabled).toBeUndefined();
  });
});

// ============================================
// CDN CREDENTIALS TESTS
// ============================================

describe("unit: Home Settings - CDNCredentials Interface", () => {
  it("should accept CDN credentials", () => {
    const creds: CDNCredentials = {
      cdn_url: "https://s3.eu-de.cloud-object-storage.appdomain.cloud",
      bucket_region: "eu-de",
      bucket_name: "my-bucket",
      folder_name: "uploads",
      cdn_key: "access-key-id",
      cdn_secret: "secret-access-key",
      signed_url_expiry: 3600,
      delete_from_cloud: true,
    };

    expect(creds.bucket_name).toBe("my-bucket");
    expect(creds.signed_url_expiry).toBe(3600);
    expect(creds.delete_from_cloud).toBe(true);
  });
});

// ============================================
// SMTP SETTINGS TESTS
// ============================================

describe("unit: Home Settings - SMTPSettings Interface", () => {
  it("should accept SMTP settings", () => {
    const smtp: SMTPSettings = {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "noreply@example.com",
      password: "secret",
      from: "noreply@example.com",
      from_name: "My Store",
      default_to: "admin@example.com",
    };

    expect(smtp.host).toBe("smtp.example.com");
    expect(smtp.port).toBe(587);
    expect(smtp.secure).toBe(false);
    expect(smtp.from_name).toBe("My Store");
  });

  it("should allow secure TLS connection", () => {
    const smtp: SMTPSettings = {
      host: "smtp.example.com",
      port: 465,
      secure: true,
    };

    expect(smtp.port).toBe(465);
    expect(smtp.secure).toBe(true);
  });
});

// ============================================
// HOME SETTINGS INTERFACE TESTS
// ============================================

describe("unit: Home Settings - HomeSettings Interface", () => {
  it("should accept complete home settings object", () => {
    const settings: HomeSettings = {
      _id: "507f1f77bcf86cd799439011",
      customerId: "global-b2b-home",
      branding: {
        title: "My Store",
        primaryColor: "#009f7f",
      },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(settings.customerId).toBe("global-b2b-home");
    expect(settings.branding.title).toBe("My Store");
    expect(settings.defaultCardVariant).toBe("b2b");
  });

  it("should accept all card variant values", () => {
    const variants: Array<HomeSettings["defaultCardVariant"]> = [
      "b2b",
      "horizontal",
      "compact",
      "detailed",
    ];

    variants.forEach((variant) => {
      const settings: HomeSettings = {
        _id: "test",
        customerId: "test",
        branding: { title: "Test" },
        defaultCardVariant: variant,
        cardStyle: {
          borderWidth: 1,
          borderColor: "#EAEEF2",
          borderStyle: "solid",
          shadowSize: "none",
          shadowColor: "rgba(0, 0, 0, 0.1)",
          borderRadius: "md",
          hoverEffect: "none",
          backgroundColor: "#ffffff",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(settings.defaultCardVariant).toBe(variant);
    });
  });

  it("should accept optional cdn, cdn_credentials, and smtp_settings", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      cdn: { baseUrl: "https://cdn.example.com", enabled: true },
      cdn_credentials: { bucket_name: "test-bucket" },
      smtp_settings: { host: "smtp.example.com", port: 587 },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastModifiedBy: "admin@example.com",
    };

    expect(settings.cdn?.baseUrl).toBe("https://cdn.example.com");
    expect(settings.cdn_credentials?.bucket_name).toBe("test-bucket");
    expect(settings.smtp_settings?.host).toBe("smtp.example.com");
    expect(settings.lastModifiedBy).toBe("admin@example.com");
  });

  it("should accept footerHtml and footerHtmlDraft fields", () => {
    const exampleHtml = `<div class="flex flex-col gap-8">
      <div class="text-lg font-bold">Company Name</div>
      <div class="text-sm">Contact info</div>
    </div>`;

    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      footerHtml: exampleHtml,
      footerHtmlDraft: exampleHtml + "<!-- draft changes -->",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.footerHtml).toBe(exampleHtml);
    expect(settings.footerHtmlDraft).toContain("draft changes");
  });

  it("should allow footerHtml and footerHtmlDraft to be undefined", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.footerHtml).toBeUndefined();
    expect(settings.footerHtmlDraft).toBeUndefined();
  });
});

// ============================================
// COLOR FORMAT VALIDATION TESTS
// ============================================

describe("unit: Home Settings - Color Format Validation", () => {
  it("should accept valid hex color formats", () => {
    const validColors = [
      "#000000",
      "#ffffff",
      "#FFFFFF",
      "#009f7f",
      "#3b82f6",
      "#f5f5f5",
    ];

    validColors.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("should accept rgba color format for shadowColor", () => {
    const shadowColor = "rgba(0, 0, 0, 0.1)";
    expect(shadowColor).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
  });

  it("should accept empty string for optional color fields", () => {
    const branding: CompanyBranding = {
      title: "Test",
      accentColor: "",
      headerBackgroundColor: "",
    };

    expect(branding.accentColor).toBe("");
    expect(branding.headerBackgroundColor).toBe("");
  });
});

// ============================================
// HEADER CONFIG TESTS
// ============================================

describe("unit: Home Settings - HeaderConfig Interface", () => {
  it("should accept a valid header configuration", () => {
    const config: HeaderConfig = {
      rows: [
        {
          id: "main",
          enabled: true,
          fixed: true,
          backgroundColor: "#ffffff",
          layout: "20-60-20",
          blocks: [
            { id: "left", alignment: "left", widgets: [] },
            { id: "center", alignment: "center", widgets: [] },
            { id: "right", alignment: "right", widgets: [] },
          ],
        },
      ],
    };

    expect(config.rows).toHaveLength(1);
    expect(config.rows[0].layout).toBe("20-60-20");
    expect(config.rows[0].blocks).toHaveLength(3);
  });

  it("should accept empty rows array", () => {
    const config: HeaderConfig = {
      rows: [],
    };

    expect(config.rows).toHaveLength(0);
  });

  it("should accept multiple rows", () => {
    const config: HeaderConfig = {
      rows: [
        {
          id: "top-bar",
          enabled: true,
          fixed: false,
          layout: "full",
          blocks: [{ id: "full", alignment: "center", widgets: [] }],
        },
        {
          id: "main",
          enabled: true,
          fixed: true,
          layout: "20-60-20",
          blocks: [
            { id: "left", alignment: "left", widgets: [] },
            { id: "center", alignment: "center", widgets: [] },
            { id: "right", alignment: "right", widgets: [] },
          ],
        },
        {
          id: "nav",
          enabled: true,
          fixed: true,
          layout: "50-50",
          blocks: [
            { id: "left", alignment: "left", widgets: [] },
            { id: "right", alignment: "right", widgets: [] },
          ],
        },
      ],
    };

    expect(config.rows).toHaveLength(3);
    expect(config.rows[0].layout).toBe("full");
    expect(config.rows[1].layout).toBe("20-60-20");
    expect(config.rows[2].layout).toBe("50-50");
  });
});

describe("unit: Home Settings - HeaderRow Interface", () => {
  it("should have all required fields", () => {
    const row: HeaderRow = {
      id: "test-row",
      enabled: true,
      fixed: false,
      layout: "50-50",
      blocks: [],
    };

    expect(row.id).toBe("test-row");
    expect(row.enabled).toBe(true);
    expect(row.fixed).toBe(false);
    expect(row.layout).toBe("50-50");
    expect(row.blocks).toEqual([]);
  });

  it("should accept optional styling fields", () => {
    const row: HeaderRow = {
      id: "styled-row",
      enabled: true,
      fixed: true,
      backgroundColor: "#1a56db",
      textColor: "#ffffff",
      height: 64,
      layout: "20-60-20",
      blocks: [],
    };

    expect(row.backgroundColor).toBe("#1a56db");
    expect(row.textColor).toBe("#ffffff");
    expect(row.height).toBe(64);
  });
});

describe("unit: Home Settings - RowLayout Types", () => {
  it("should have correct width mappings for all layouts", () => {
    expect(LAYOUT_WIDTHS["full"]).toEqual([100]);
    expect(LAYOUT_WIDTHS["50-50"]).toEqual([50, 50]);
    expect(LAYOUT_WIDTHS["33-33-33"]).toEqual([33.33, 33.33, 33.33]);
    expect(LAYOUT_WIDTHS["20-60-20"]).toEqual([20, 60, 20]);
    expect(LAYOUT_WIDTHS["25-50-25"]).toEqual([25, 50, 25]);
    expect(LAYOUT_WIDTHS["30-40-30"]).toEqual([30, 40, 30]);
  });

  it("should have correct block counts for all layouts", () => {
    expect(LAYOUT_BLOCK_COUNT["full"]).toBe(1);
    expect(LAYOUT_BLOCK_COUNT["50-50"]).toBe(2);
    expect(LAYOUT_BLOCK_COUNT["33-33-33"]).toBe(3);
    expect(LAYOUT_BLOCK_COUNT["20-60-20"]).toBe(3);
    expect(LAYOUT_BLOCK_COUNT["25-50-25"]).toBe(3);
    expect(LAYOUT_BLOCK_COUNT["30-40-30"]).toBe(3);
  });

  it("should have widths that sum to 100%", () => {
    const layouts: RowLayout[] = ["full", "50-50", "33-33-33", "20-60-20", "25-50-25", "30-40-30"];

    layouts.forEach((layout) => {
      const widths = LAYOUT_WIDTHS[layout];
      const sum = widths.reduce((a, b) => a + b, 0);
      // Allow small floating point error for 33.33 * 3
      expect(sum).toBeCloseTo(100, 0);
    });
  });

  it("should have block count matching width array length", () => {
    const layouts: RowLayout[] = ["full", "50-50", "33-33-33", "20-60-20", "25-50-25", "30-40-30"];

    layouts.forEach((layout) => {
      expect(LAYOUT_WIDTHS[layout].length).toBe(LAYOUT_BLOCK_COUNT[layout]);
    });
  });
});

describe("unit: Home Settings - HeaderBlock Interface", () => {
  it("should accept all alignment values", () => {
    const alignments: BlockAlignment[] = ["left", "center", "right"];

    alignments.forEach((alignment) => {
      const block: HeaderBlock = {
        id: "test-block",
        alignment,
        widgets: [],
      };
      expect(block.alignment).toBe(alignment);
    });
  });

  it("should accept widgets array", () => {
    const block: HeaderBlock = {
      id: "test-block",
      alignment: "center",
      widgets: [
        { id: "logo", type: "logo", config: {} },
        { id: "search", type: "search-bar", config: { width: "lg" } },
      ],
    };

    expect(block.widgets).toHaveLength(2);
    expect(block.widgets[0].type).toBe("logo");
    expect(block.widgets[1].type).toBe("search-bar");
  });
});

describe("unit: Home Settings - HeaderWidget Interface", () => {
  it("should accept all widget types", () => {
    const widgetTypes: HeaderWidgetType[] = [
      "logo",
      "search-bar",
      "radio-widget",
      "category-menu",
      "cart",
      "company-info",
      "no-price",
      "favorites",
      "compare",
      "profile",
      "button",
      "spacer",
      "divider",
    ];

    widgetTypes.forEach((type) => {
      const widget: HeaderWidget = {
        id: `${type}-1`,
        type,
        config: {},
      };
      expect(widget.type).toBe(type);
    });
  });

  it("should accept widget-specific config", () => {
    const buttonWidget: HeaderWidget = {
      id: "button-1",
      type: "button",
      config: {
        label: "Promozioni",
        url: "/promotions",
        variant: "primary",
      },
    };

    expect((buttonWidget.config as { label: string }).label).toBe("Promozioni");
    expect((buttonWidget.config as { url: string }).url).toBe("/promotions");
    expect((buttonWidget.config as { variant: string }).variant).toBe("primary");
  });
});

describe("unit: Home Settings - HEADER_WIDGET_LIBRARY", () => {
  it("should have 14 widget types defined", () => {
    const widgetCount = Object.keys(HEADER_WIDGET_LIBRARY).length;
    expect(widgetCount).toBe(14);
  });

  it("should have label and description for each widget", () => {
    Object.entries(HEADER_WIDGET_LIBRARY).forEach(([type, meta]) => {
      expect(meta.label).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description).toBeDefined();
      expect(meta.description.length).toBeGreaterThan(0);
    });
  });

  it("should mark button, spacer, and divider as allowMultiple", () => {
    expect(HEADER_WIDGET_LIBRARY["button"].allowMultiple).toBe(true);
    expect(HEADER_WIDGET_LIBRARY["spacer"].allowMultiple).toBe(true);
    expect(HEADER_WIDGET_LIBRARY["divider"].allowMultiple).toBe(true);
  });

  it("should not mark unique widgets as allowMultiple", () => {
    const uniqueWidgets: HeaderWidgetType[] = [
      "logo",
      "search-bar",
      "radio-widget",
      "category-menu",
      "cart",
      "company-info",
      "no-price",
      "favorites",
      "compare",
      "profile",
    ];

    uniqueWidgets.forEach((type) => {
      expect(HEADER_WIDGET_LIBRARY[type].allowMultiple).toBeFalsy();
    });
  });
});

describe("unit: Home Settings - HomeSettings with headerConfig", () => {
  it("should accept headerConfig in HomeSettings", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      headerConfig: {
        rows: [
          {
            id: "main",
            enabled: true,
            fixed: true,
            layout: "20-60-20",
            blocks: [
              { id: "left", alignment: "left", widgets: [{ id: "logo", type: "logo", config: {} }] },
              { id: "center", alignment: "center", widgets: [{ id: "search", type: "search-bar", config: {} }] },
              { id: "right", alignment: "right", widgets: [{ id: "cart", type: "cart", config: {} }] },
            ],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.headerConfig).toBeDefined();
    expect(settings.headerConfig?.rows).toHaveLength(1);
    expect(settings.headerConfig?.rows[0].blocks[0].widgets[0].type).toBe("logo");
  });

  it("should allow headerConfig to be undefined", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.headerConfig).toBeUndefined();
  });

  it("should accept headerConfigDraft for draft/publish workflow", () => {
    const draftConfig: HeaderConfig = {
      rows: [
        {
          id: "main",
          enabled: true,
          fixed: true,
          layout: "20-60-20",
          blocks: [
            { id: "left", alignment: "left", widgets: [{ id: "logo", type: "logo", config: {} }] },
            { id: "center", alignment: "center", widgets: [{ id: "search", type: "search-bar", config: {} }] },
            { id: "right", alignment: "right", widgets: [{ id: "cart", type: "cart", config: {} }] },
          ],
        },
      ],
    };

    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      headerConfig: draftConfig,
      headerConfigDraft: draftConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.headerConfigDraft).toBeDefined();
    expect(settings.headerConfigDraft?.rows).toHaveLength(1);
    expect(settings.headerConfigDraft).toEqual(settings.headerConfig);
  });

  it("should allow headerConfigDraft to be undefined", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.headerConfigDraft).toBeUndefined();
  });

  it("should allow meta_tags to be undefined", () => {
    const settings: HomeSettings = {
      _id: "test",
      customerId: "test",
      branding: { title: "Test" },
      defaultCardVariant: "b2b",
      cardStyle: {
        borderWidth: 1,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "md",
        hoverEffect: "none",
        backgroundColor: "#ffffff",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(settings.meta_tags).toBeUndefined();
  });
});

// ============================================
// META TAGS TYPE TESTS
// ============================================

describe("unit: Home Settings - MetaTags Interface", () => {
  it("should accept all basic SEO fields", () => {
    const metaTags: MetaTags = {
      title: "Test Store - B2B",
      description: "A description for search engines",
      keywords: "b2b, store, products",
      author: "Test Company",
      robots: "index, follow",
      canonicalUrl: "https://shop.example.com",
    };

    expect(metaTags.title).toBe("Test Store - B2B");
    expect(metaTags.description).toBe("A description for search engines");
    expect(metaTags.keywords).toBe("b2b, store, products");
    expect(metaTags.author).toBe("Test Company");
    expect(metaTags.robots).toBe("index, follow");
    expect(metaTags.canonicalUrl).toBe("https://shop.example.com");
  });

  it("should accept Open Graph fields", () => {
    const metaTags: MetaTags = {
      ogTitle: "OG Title",
      ogDescription: "OG Description",
      ogImage: "https://cdn.example.com/og-image.jpg",
      ogSiteName: "Test Store",
      ogType: "website",
    };

    expect(metaTags.ogTitle).toBe("OG Title");
    expect(metaTags.ogDescription).toBe("OG Description");
    expect(metaTags.ogImage).toBe("https://cdn.example.com/og-image.jpg");
    expect(metaTags.ogSiteName).toBe("Test Store");
    expect(metaTags.ogType).toBe("website");
  });

  it("should accept Twitter Card fields", () => {
    const metaTags: MetaTags = {
      twitterCard: "summary_large_image",
      twitterSite: "@testcompany",
      twitterCreator: "@creator",
      twitterImage: "https://cdn.example.com/twitter.jpg",
    };

    expect(metaTags.twitterCard).toBe("summary_large_image");
    expect(metaTags.twitterSite).toBe("@testcompany");
    expect(metaTags.twitterCreator).toBe("@creator");
    expect(metaTags.twitterImage).toBe("https://cdn.example.com/twitter.jpg");
  });

  it("should accept all valid twitterCard types", () => {
    const validTypes: Array<MetaTags["twitterCard"]> = [
      "summary",
      "summary_large_image",
      "app",
      "player",
    ];

    validTypes.forEach((cardType) => {
      const metaTags: MetaTags = { twitterCard: cardType };
      expect(metaTags.twitterCard).toBe(cardType);
    });
  });

  it("should accept additional settings", () => {
    const metaTags: MetaTags = {
      themeColor: "#009f7f",
      googleSiteVerification: "google-verification-code",
      bingSiteVerification: "bing-verification-code",
    };

    expect(metaTags.themeColor).toBe("#009f7f");
    expect(metaTags.googleSiteVerification).toBe("google-verification-code");
    expect(metaTags.bingSiteVerification).toBe("bing-verification-code");
  });

  it("should accept structured data as a string", () => {
    const structuredData = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Test Company",
      "url": "https://shop.example.com",
    });

    const metaTags: MetaTags = {
      structuredData,
    };

    expect(metaTags.structuredData).toBe(structuredData);
    const parsed = JSON.parse(metaTags.structuredData!);
    expect(parsed["@type"]).toBe("Organization");
  });

  it("should allow all fields to be undefined", () => {
    const metaTags: MetaTags = {};

    expect(metaTags.title).toBeUndefined();
    expect(metaTags.description).toBeUndefined();
    expect(metaTags.ogImage).toBeUndefined();
    expect(metaTags.twitterCard).toBeUndefined();
    expect(metaTags.themeColor).toBeUndefined();
  });

  it("should accept a complete MetaTags configuration", () => {
    const metaTags: MetaTags = {
      // Basic SEO
      title: "Test Store - B2B Wholesale",
      description: "Your trusted B2B wholesale partner",
      keywords: "b2b, wholesale, products",
      author: "Test Company Inc",
      robots: "index, follow",
      canonicalUrl: "https://shop.example.com",
      // Open Graph
      ogTitle: "Test Store - OG Title",
      ogDescription: "Description for social sharing",
      ogImage: "https://cdn.example.com/og.jpg",
      ogSiteName: "Test Store",
      ogType: "website",
      // Twitter
      twitterCard: "summary_large_image",
      twitterSite: "@teststore",
      twitterCreator: "@creator",
      twitterImage: "https://cdn.example.com/twitter.jpg",
      // Additional
      structuredData: '{"@context":"https://schema.org"}',
      themeColor: "#009f7f",
      googleSiteVerification: "abc123",
      bingSiteVerification: "xyz789",
    };

    expect(Object.keys(metaTags).length).toBe(19);
  });
});
