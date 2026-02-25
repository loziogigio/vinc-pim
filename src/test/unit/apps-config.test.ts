/**
 * Unit Tests for Apps Config
 *
 * Tests the centralized app registry and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  APPS,
  getAppById,
  getAppByPath,
  getLauncherApps,
  getHeaderApps,
  getCurrentSection,
  type AppConfig,
} from "@/config/apps.config";

// ============================================
// APPS ARRAY TESTS
// ============================================

describe("unit: Apps Config - APPS Array", () => {
  it("should have all required apps defined", () => {
    /**
     * Verify all expected apps are in the registry.
     */
    const expectedAppIds = [
      "home",
      "pim",
      "correlations",
      "store-orders",
      "store-customers",
      "store-portal-users",
      "builder",
      "b2c",
      "settings",
    ];
    const actualAppIds = APPS.map((app) => app.id);

    expectedAppIds.forEach((id) => {
      expect(actualAppIds).toContain(id);
    });
  });

  it("should have valid structure for each app", () => {
    /**
     * Each app should have all required fields.
     */
    APPS.forEach((app) => {
      expect(app.id).toBeDefined();
      expect(app.id).not.toBe("");
      expect(app.name).toBeDefined();
      expect(app.name).not.toBe("");
      expect(app.description).toBeDefined();
      expect(app.href).toBeDefined();
      expect(app.href).toMatch(/^\/b2b/); // All B2B apps start with /b2b
      expect(app.icon).toBeDefined();
      // Lucide icons are React components (objects with $$typeof)
      expect(app.icon).toBeTruthy();
      expect(app.color).toBeDefined();
      expect(typeof app.showInLauncher).toBe("boolean");
      expect(typeof app.showInHeader).toBe("boolean");
      expect(typeof app.hasNavigation).toBe("boolean");
    });
  });

  it("should have unique app IDs", () => {
    /**
     * App IDs must be unique.
     */
    const ids = APPS.map((app) => app.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have unique hrefs", () => {
    /**
     * App hrefs must be unique.
     */
    const hrefs = APPS.map((app) => app.href);
    const uniqueHrefs = new Set(hrefs);
    expect(uniqueHrefs.size).toBe(hrefs.length);
  });
});

// ============================================
// getAppById TESTS
// ============================================

describe("unit: Apps Config - getAppById", () => {
  it("should return correct app for valid ID", () => {
    const pim = getAppById("pim");
    expect(pim).toBeDefined();
    expect(pim?.name).toBe("PIM");
    expect(pim?.href).toBe("/b2b/pim");
  });

  it("should return undefined for invalid ID", () => {
    const result = getAppById("non-existent");
    expect(result).toBeUndefined();
  });

  it("should return correct app for each known ID", () => {
    const testCases = [
      { id: "home", expectedName: "Home" },
      { id: "pim", expectedName: "PIM" },
      { id: "store-orders", expectedName: "Store" },
      { id: "store-customers", expectedName: "Customers" },
      { id: "store-portal-users", expectedName: "Portal Users" },
      { id: "correlations", expectedName: "Correlazioni" },
      { id: "builder", expectedName: "Builder" },
      { id: "b2c", expectedName: "B2C" },
      { id: "settings", expectedName: "Settings" },
    ];

    testCases.forEach(({ id, expectedName }) => {
      const app = getAppById(id);
      expect(app).toBeDefined();
      expect(app?.name).toBe(expectedName);
    });
  });
});

// ============================================
// getAppByPath TESTS
// ============================================

describe("unit: Apps Config - getAppByPath", () => {
  it("should match exact path", () => {
    const app = getAppByPath("/b2b/pim");
    expect(app).toBeDefined();
    expect(app?.id).toBe("pim");
  });

  it("should match nested paths", () => {
    const app = getAppByPath("/b2b/pim/products");
    expect(app).toBeDefined();
    expect(app?.id).toBe("pim");
  });

  it("should match deeply nested paths", () => {
    const app = getAppByPath("/b2b/pim/products/123/edit");
    expect(app).toBeDefined();
    expect(app?.id).toBe("pim");
  });

  it("should match store orders path", () => {
    const app = getAppByPath("/b2b/store/orders");
    expect(app).toBeDefined();
    expect(app?.id).toBe("store-orders");
  });

  it("should match store customers path", () => {
    const app = getAppByPath("/b2b/store/customers");
    expect(app).toBeDefined();
    expect(app?.id).toBe("store-customers");
  });

  it("should match correlations paths", () => {
    const app = getAppByPath("/b2b/correlations/related-products");
    expect(app).toBeDefined();
    expect(app?.id).toBe("correlations");
  });

  it("should match builder path", () => {
    const app = getAppByPath("/b2b/home-builder");
    expect(app).toBeDefined();
    expect(app?.id).toBe("builder");
  });

  it("should match settings path", () => {
    const app = getAppByPath("/b2b/home-settings");
    expect(app).toBeDefined();
    expect(app?.id).toBe("settings");
  });

  it("should return undefined for non-matching path", () => {
    const app = getAppByPath("/admin/something");
    expect(app).toBeUndefined();
  });

  it("should handle paths with tenant prefix", () => {
    // getAppByPath strips tenant prefix internally
    const app = getAppByPath("/hidros-it/b2b/pim");
    expect(app).toBeDefined();
    expect(app?.id).toBe("pim");
  });

  it("should prefer more specific path matches", () => {
    // /b2b/store/orders should match store-orders specifically
    const app = getAppByPath("/b2b/store/orders/123");
    expect(app?.id).toBe("store-orders");
  });
});

// ============================================
// getLauncherApps TESTS
// ============================================

describe("unit: Apps Config - getLauncherApps", () => {
  it("should return only apps with showInLauncher=true", () => {
    const launcherApps = getLauncherApps();

    launcherApps.forEach((app) => {
      expect(app.showInLauncher).toBe(true);
    });
  });

  it("should return multiple apps", () => {
    const launcherApps = getLauncherApps();
    expect(launcherApps.length).toBeGreaterThan(0);
  });

  it("should include PIM in launcher", () => {
    const launcherApps = getLauncherApps();
    const pim = launcherApps.find((app) => app.id === "pim");
    expect(pim).toBeDefined();
  });

  it("should include Store Orders in launcher", () => {
    const launcherApps = getLauncherApps();
    const store = launcherApps.find((app) => app.id === "store-orders");
    expect(store).toBeDefined();
  });

  it("should not include apps with showInLauncher=false", () => {
    const launcherApps = getLauncherApps();
    const allShowInLauncher = launcherApps.every((app) => app.showInLauncher);
    expect(allShowInLauncher).toBe(true);
  });
});

// ============================================
// getHeaderApps TESTS
// ============================================

describe("unit: Apps Config - getHeaderApps", () => {
  it("should return only apps with showInHeader=true", () => {
    const headerApps = getHeaderApps();

    headerApps.forEach((app) => {
      expect(app.showInHeader).toBe(true);
    });
  });

  it("should return apps for header display", () => {
    const headerApps = getHeaderApps();
    expect(headerApps.length).toBeGreaterThan(0);
  });

  it("should not include Home in header", () => {
    const headerApps = getHeaderApps();
    const home = headerApps.find((app) => app.id === "home");
    expect(home).toBeUndefined();
  });
});

// ============================================
// getCurrentSection TESTS
// ============================================

describe("unit: Apps Config - getCurrentSection", () => {
  it("should return correct section for PIM path", () => {
    const section = getCurrentSection("/b2b/pim/products");
    expect(section.name).toBe("PIM");
    expect(section.icon).toBeDefined();
    expect(section.color).toBeDefined();
  });

  it("should return correct section for Store Orders path", () => {
    const section = getCurrentSection("/b2b/store/orders");
    expect(section.name).toBe("Store");
  });

  it("should return correct section for Correlations path", () => {
    const section = getCurrentSection("/b2b/correlations");
    expect(section.name).toBe("Correlazioni");
  });

  it("should return correct section for Builder path", () => {
    const section = getCurrentSection("/b2b/home-builder");
    expect(section.name).toBe("Builder");
  });

  it("should return correct section for Settings path", () => {
    const section = getCurrentSection("/b2b/home-settings");
    expect(section.name).toBe("Settings");
  });

  it("should return Dashboard section for unmatched path", () => {
    const section = getCurrentSection("/some/unknown/path");
    expect(section.name).toBe("Dashboard");
  });

  it("should return Dashboard section for empty path", () => {
    const section = getCurrentSection("");
    expect(section.name).toBe("Dashboard");
  });

  it("should handle tenant-prefixed paths by stripping prefix", () => {
    // getCurrentSection handles tenant prefixes internally via getAppByPath
    const section = getCurrentSection("/hidros-it/b2b/pim/products");
    expect(section.name).toBe("PIM");
  });

  it("should always return valid section object", () => {
    const paths = [
      "/b2b/pim",
      "/b2b/store/orders",
      "/unknown",
      "",
      "/",
      "/tenant/b2b/pim",
    ];

    paths.forEach((path) => {
      const section = getCurrentSection(path);
      expect(section).toBeDefined();
      expect(section.name).toBeDefined();
      expect(section.icon).toBeDefined();
      expect(section.color).toBeDefined();
    });
  });
});

// ============================================
// APP SPECIFIC TESTS
// ============================================

describe("unit: Apps Config - App Specific Properties", () => {
  it("PIM should have navigation enabled", () => {
    const pim = getAppById("pim");
    expect(pim?.hasNavigation).toBe(true);
  });

  it("Store Orders should have navigation enabled", () => {
    const store = getAppById("store-orders");
    expect(store?.hasNavigation).toBe(true);
  });

  it("Correlations should have navigation enabled", () => {
    const correlations = getAppById("correlations");
    expect(correlations?.hasNavigation).toBe(true);
  });

  it("Builder should not have navigation (uses full-screen editor)", () => {
    const builder = getAppById("builder");
    expect(builder?.hasNavigation).toBe(false);
  });

  it("Settings should not have navigation", () => {
    const settings = getAppById("settings");
    expect(settings?.hasNavigation).toBe(false);
  });

  it("Home should not appear in header", () => {
    const home = getAppById("home");
    expect(home?.showInHeader).toBe(false);
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("unit: Apps Config - Integration", () => {
  it("should provide consistent data across helper functions", () => {
    /**
     * All helper functions should work together consistently.
     */
    const launcherApps = getLauncherApps();

    launcherApps.forEach((app) => {
      // Each launcher app should be findable by ID
      const foundById = getAppById(app.id);
      expect(foundById).toBeDefined();
      expect(foundById?.id).toBe(app.id);

      // Each launcher app should be findable by path
      const foundByPath = getAppByPath(app.href);
      expect(foundByPath).toBeDefined();
      expect(foundByPath?.id).toBe(app.id);

      // getCurrentSection should return correct name
      const section = getCurrentSection(app.href);
      expect(section.name).toBe(app.name);
    });
  });

  it("should handle all store sub-apps correctly", () => {
    /**
     * Store has multiple sub-apps that should each be identifiable.
     */
    const storeApps = ["store-orders", "store-customers", "store-portal-users"];

    storeApps.forEach((appId) => {
      const app = getAppById(appId);
      expect(app).toBeDefined();
      expect(app?.href).toContain("/b2b/store/");
      expect(app?.showInLauncher).toBe(true);
      expect(app?.hasNavigation).toBe(true);
    });
  });
});

// ============================================
// B2C APP TESTS
// ============================================

describe("unit: Apps Config - B2C App", () => {
  it("should be registered in app registry", () => {
    const b2c = getAppById("b2c");
    expect(b2c).toBeDefined();
    expect(b2c?.name).toBe("B2C");
    expect(b2c?.href).toBe("/b2b/b2c");
  });

  it("should have navigation enabled", () => {
    const b2c = getAppById("b2c");
    expect(b2c?.hasNavigation).toBe(true);
  });

  it("should appear in launcher and header", () => {
    const b2c = getAppById("b2c");
    expect(b2c?.showInLauncher).toBe(true);
    expect(b2c?.showInHeader).toBe(true);
  });

  it("should match B2C sub-paths correctly", () => {
    const app = getAppByPath("/b2b/b2c/storefronts");
    expect(app?.id).toBe("b2c");
  });

  it("should match B2C nested paths", () => {
    const app = getAppByPath("/b2b/b2c/storefronts/main-shop");
    expect(app?.id).toBe("b2c");
  });

  it("should handle B2C with tenant prefix", () => {
    const app = getAppByPath("/hidros-it/b2b/b2c/storefronts");
    expect(app?.id).toBe("b2c");
  });

  it("should return B2C section from getCurrentSection", () => {
    const section = getCurrentSection("/b2b/b2c/storefronts");
    expect(section.name).toBe("B2C");
  });
});
