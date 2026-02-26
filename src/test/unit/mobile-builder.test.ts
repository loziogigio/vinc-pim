/**
 * Unit Tests for Mobile Builder
 *
 * Tests the mobile builder types, block library, app identity, and app registration.
 */

import { describe, it, expect } from "vitest";
import {
  MOBILE_BLOCK_TYPES,
  MOBILE_BLOCK_LIBRARY,
  DEFAULT_APP_IDENTITY,
  createDefaultBlock,
  createDefaultMediaSliderBlock,
  createDefaultProductSliderBlock,
  createDefaultMediaGalleryBlock,
  createDefaultProductGalleryBlock,
  createDefaultCategorySliderBlock,
  createDefaultCategoryGalleryBlock,
  createDefaultEntitySliderBlock,
  createDefaultEntityGalleryBlock,
  type MobileBlockType,
  type MobileMediaSliderBlock,
  type MobileProductSliderBlock,
  type MobileMediaGalleryBlock,
  type MobileProductGalleryBlock,
} from "@/lib/types/mobile-builder";
import {
  getAppById,
  getAppByPath,
  getLauncherApps,
  getCurrentSection,
} from "@/config/apps.config";

// ============================================
// MOBILE_BLOCK_TYPES TESTS
// ============================================

describe("unit: Mobile Builder - MOBILE_BLOCK_TYPES", () => {
  it("should have all 8 block types defined", () => {
    expect(MOBILE_BLOCK_TYPES).toHaveLength(8);
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_media_slider");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_product_slider");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_media_gallery");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_product_gallery");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_category_slider");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_category_gallery");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_entity_slider");
    expect(MOBILE_BLOCK_TYPES).toContain("mobile_entity_gallery");
  });

  it("should not contain mobile_logo (moved to app identity)", () => {
    expect(MOBILE_BLOCK_TYPES).not.toContain("mobile_logo");
  });

  it("should have unique block types", () => {
    const uniqueTypes = new Set(MOBILE_BLOCK_TYPES);
    expect(uniqueTypes.size).toBe(MOBILE_BLOCK_TYPES.length);
  });

  it("should all start with mobile_ prefix", () => {
    MOBILE_BLOCK_TYPES.forEach((type) => {
      expect(type).toMatch(/^mobile_/);
    });
  });
});

// ============================================
// DEFAULT_APP_IDENTITY TESTS
// ============================================

describe("unit: Mobile Builder - DEFAULT_APP_IDENTITY", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_APP_IDENTITY.app_name).toBe("");
    expect(DEFAULT_APP_IDENTITY.logo_url).toBe("");
    expect(DEFAULT_APP_IDENTITY.logo_width).toBe(64);
  });

  it("should not have logo_height set by default", () => {
    expect(DEFAULT_APP_IDENTITY.logo_height).toBeUndefined();
  });

  it("should have default primary_color for buttons", () => {
    expect(DEFAULT_APP_IDENTITY.primary_color).toBe("#ec4899");
    expect(DEFAULT_APP_IDENTITY.primary_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ============================================
// MOBILE_BLOCK_LIBRARY TESTS
// ============================================

describe("unit: Mobile Builder - MOBILE_BLOCK_LIBRARY", () => {
  it("should have metadata for all block types", () => {
    expect(MOBILE_BLOCK_LIBRARY).toHaveLength(8);

    MOBILE_BLOCK_TYPES.forEach((type) => {
      const meta = MOBILE_BLOCK_LIBRARY.find((b) => b.type === type);
      expect(meta).toBeDefined();
    });
  });

  it("should have valid structure for each block metadata", () => {
    MOBILE_BLOCK_LIBRARY.forEach((block) => {
      expect(block.type).toBeDefined();
      expect(block.name).toBeDefined();
      expect(block.name).not.toBe("");
      expect(block.description).toBeDefined();
      expect(block.description).not.toBe("");
      expect(block.icon).toBeDefined();
      expect(block.icon).not.toBe("");
      expect(MOBILE_BLOCK_TYPES).toContain(block.type);
    });
  });

  it("should have expected names for blocks", () => {
    const expectedNames: Record<MobileBlockType, string> = {
      mobile_media_slider: "Media Slider",
      mobile_product_slider: "Product Slider",
      mobile_media_gallery: "Media Gallery",
      mobile_product_gallery: "Product Gallery",
    };

    Object.entries(expectedNames).forEach(([type, name]) => {
      const block = MOBILE_BLOCK_LIBRARY.find((b) => b.type === type);
      expect(block?.name).toBe(name);
    });
  });

  it("should have unique types in library", () => {
    const types = MOBILE_BLOCK_LIBRARY.map((b) => b.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });
});

// ============================================
// INDIVIDUAL BLOCK CREATOR TESTS
// ============================================

describe("unit: Mobile Builder - createDefaultMediaSliderBlock", () => {
  it("should create media slider block with correct structure", () => {
    const block = createDefaultMediaSliderBlock("slider-1");
    expect(block.id).toBe("slider-1");
    expect(block.type).toBe("mobile_media_slider");
    expect(block.visibility).toBe("all");
    expect(block.settings).toBeDefined();
    expect(block.items).toBeDefined();
  });

  it("should have correct default settings", () => {
    const block = createDefaultMediaSliderBlock("slider-2");
    expect(block.settings.autoplay).toBe(true);
    expect(block.settings.autoplay_interval).toBe(5000);
    expect(block.settings.show_dots).toBe(true);
    expect(block.settings.show_arrows).toBe(false);
    expect(block.settings.aspect_ratio).toBe("16:9");
    expect(block.items).toEqual([]);
  });
});

describe("unit: Mobile Builder - createDefaultProductSliderBlock", () => {
  it("should create product slider block with correct structure", () => {
    const block = createDefaultProductSliderBlock("product-slider-1");
    expect(block.id).toBe("product-slider-1");
    expect(block.type).toBe("mobile_product_slider");
    expect(block.visibility).toBe("all");
    expect(block.settings).toBeDefined();
  });

  it("should have correct default settings", () => {
    const block = createDefaultProductSliderBlock("product-slider-2");
    expect(block.settings.show_title).toBe(true);
    expect(block.settings.title).toBe("Featured Products");
    expect(block.settings.items_visible).toBe(2);
    expect(block.settings.show_price).toBe(true);
    expect(block.settings.show_add_to_cart).toBe(false);
    expect(block.settings.source).toBe("search");
    expect(block.search_query).toBe("");
    expect(block.limit).toBe(10);
  });
});

describe("unit: Mobile Builder - createDefaultMediaGalleryBlock", () => {
  it("should create media gallery block with correct structure", () => {
    const block = createDefaultMediaGalleryBlock("gallery-1");
    expect(block.id).toBe("gallery-1");
    expect(block.type).toBe("mobile_media_gallery");
    expect(block.visibility).toBe("all");
    expect(block.settings).toBeDefined();
    expect(block.items).toBeDefined();
  });

  it("should have correct default settings", () => {
    const block = createDefaultMediaGalleryBlock("gallery-2");
    expect(block.settings.columns).toBe(2);
    expect(block.settings.gap).toBe("sm");
    expect(block.settings.aspect_ratio).toBe("1:1");
    expect(block.items).toEqual([]);
  });
});

describe("unit: Mobile Builder - createDefaultProductGalleryBlock", () => {
  it("should create product gallery block with correct structure", () => {
    const block = createDefaultProductGalleryBlock("product-gallery-1");
    expect(block.id).toBe("product-gallery-1");
    expect(block.type).toBe("mobile_product_gallery");
    expect(block.visibility).toBe("all");
    expect(block.settings).toBeDefined();
  });

  it("should have correct default settings", () => {
    const block = createDefaultProductGalleryBlock("product-gallery-2");
    expect(block.settings.show_title).toBe(true);
    expect(block.settings.title).toBe("Products");
    expect(block.settings.columns).toBe(2);
    expect(block.settings.gap).toBe("sm");
    expect(block.settings.show_price).toBe(true);
    expect(block.settings.show_add_to_cart).toBe(true);
    expect(block.settings.card_style).toBe("compact");
    expect(block.settings.source).toBe("search");
    expect(block.search_query).toBe("");
    expect(block.limit).toBe(12);
  });
});

// ============================================
// createDefaultBlock TESTS
// ============================================

describe("unit: Mobile Builder - createDefaultBlock", () => {
  it("should create media slider block with correct defaults", () => {
    const block = createDefaultBlock("mobile_media_slider", "test-id") as MobileMediaSliderBlock;
    expect(block.id).toBe("test-id");
    expect(block.type).toBe("mobile_media_slider");
    expect(block.visibility).toBe("all");
    expect(block.settings.autoplay).toBe(true);
    expect(block.settings.aspect_ratio).toBe("16:9");
    expect(block.items).toEqual([]);
  });

  it("should create product slider block with correct defaults", () => {
    const block = createDefaultBlock("mobile_product_slider", "test-id") as MobileProductSliderBlock;
    expect(block.id).toBe("test-id");
    expect(block.type).toBe("mobile_product_slider");
    expect(block.visibility).toBe("all");
    expect(block.settings.show_price).toBe(true);
    expect(block.settings.source).toBe("search");
    expect(block.limit).toBe(10);
  });

  it("should create media gallery block with correct defaults", () => {
    const block = createDefaultBlock("mobile_media_gallery", "test-id") as MobileMediaGalleryBlock;
    expect(block.id).toBe("test-id");
    expect(block.type).toBe("mobile_media_gallery");
    expect(block.visibility).toBe("all");
    expect(block.settings.columns).toBe(2);
    expect(block.settings.gap).toBe("sm");
    expect(block.items).toEqual([]);
  });

  it("should create product gallery block with correct defaults", () => {
    const block = createDefaultBlock("mobile_product_gallery", "test-id") as MobileProductGalleryBlock;
    expect(block.id).toBe("test-id");
    expect(block.type).toBe("mobile_product_gallery");
    expect(block.visibility).toBe("all");
    expect(block.settings.columns).toBe(2);
    expect(block.settings.card_style).toBe("compact");
    expect(block.limit).toBe(12);
  });

  it("should throw error for unknown block type", () => {
    expect(() => createDefaultBlock("unknown" as MobileBlockType, "test-id")).toThrow();
  });

  it("should create blocks with unique IDs when provided", () => {
    const block1 = createDefaultBlock("mobile_media_slider", "id-1");
    const block2 = createDefaultBlock("mobile_media_slider", "id-2");
    expect(block1.id).not.toBe(block2.id);
  });

  it("should create all block types without throwing", () => {
    MOBILE_BLOCK_TYPES.forEach((type) => {
      expect(() => createDefaultBlock(type, `test-${type}`)).not.toThrow();
    });
  });

  it("should set default visibility to 'all' for all block types", () => {
    MOBILE_BLOCK_TYPES.forEach((type) => {
      const block = createDefaultBlock(type, `visibility-test-${type}`);
      expect(block.visibility).toBe("all");
    });
  });
});

// ============================================
// BLOCK VISIBILITY TESTS
// ============================================

describe("unit: Mobile Builder - Block Visibility", () => {
  it("should support 'all' visibility (everyone can see)", () => {
    const block = createDefaultMediaSliderBlock("vis-1");
    expect(block.visibility).toBe("all");
  });

  it("should allow blocks to be created with logged_in_only visibility", () => {
    const block = createDefaultProductSliderBlock("vis-2");
    // Default is 'all', but the type should accept 'logged_in_only'
    const modifiedBlock = { ...block, visibility: "logged_in_only" as const };
    expect(modifiedBlock.visibility).toBe("logged_in_only");
  });
});

// ============================================
// APPS CONFIG INTEGRATION TESTS
// ============================================

describe("unit: Mobile Builder - Apps Config Integration", () => {
  it("should have mobile-builder registered in APPS", () => {
    const app = getAppById("mobile-builder");
    expect(app).toBeDefined();
    expect(app?.name).toBe("Mobile Builder");
    expect(app?.href).toBe("/b2b/mobile-builder");
  });

  it("should match mobile-builder paths correctly", () => {
    const app = getAppByPath("/b2b/mobile-builder");
    expect(app?.id).toBe("mobile-builder");
  });

  it("should appear in launcher apps", () => {
    const launcherApps = getLauncherApps();
    const mobileBuilder = launcherApps.find((app) => app.id === "mobile-builder");
    expect(mobileBuilder).toBeDefined();
    expect(mobileBuilder?.showInLauncher).toBe(true);
  });

  it("should have correct section detection", () => {
    const section = getCurrentSection("/b2b/mobile-builder");
    expect(section.name).toBe("Mobile Builder");
    expect(section.icon).toBeDefined();
    expect(section.color).toBeDefined();
  });

  it("should handle tenant-prefixed paths", () => {
    const app = getAppByPath("/hidros-it/b2b/mobile-builder");
    expect(app?.id).toBe("mobile-builder");
  });

  it("should have hasNavigation set to false (full-screen builder)", () => {
    const app = getAppById("mobile-builder");
    expect(app?.hasNavigation).toBe(false);
  });

  it("should show in header", () => {
    const app = getAppById("mobile-builder");
    expect(app?.showInHeader).toBe(true);
  });
});
