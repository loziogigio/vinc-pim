/**
 * Unit Tests for B2C Storefront Service
 *
 * Tests for CRUD operations, branding/header/footer configuration,
 * domain conflict validation, and domain-based lookup.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  B2CStorefrontFactory,
} from "../conftest";
import { B2CStorefrontSchema } from "@/lib/db/models/b2c-storefront";

// Create test model from schema
const B2CStorefrontModel =
  mongoose.models.B2CStorefront ||
  mongoose.model("B2CStorefront", B2CStorefrontSchema);

// Mock connection — return our test model
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({ B2CStorefront: B2CStorefrontModel })
  ),
}));

// Mock home template functions — we're testing the service, not templates
vi.mock("@/lib/db/b2c-home-templates", () => ({
  initB2CHomeTemplate: vi.fn(() => Promise.resolve()),
  deleteB2CHomeTemplates: vi.fn(() => Promise.resolve()),
}));

// Import after mocks
import {
  createStorefront,
  updateStorefront,
  deleteStorefront,
  listStorefronts,
  getStorefrontBySlug,
  getStorefrontByDomain,
} from "@/lib/services/b2c-storefront.service";
import { initB2CHomeTemplate, deleteB2CHomeTemplates } from "@/lib/db/b2c-home-templates";

// ============================================
// TESTS
// ============================================

const TEST_DB = "vinc-test-tenant";

describe("unit: B2C Storefront Service", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  // ============================================
  // createStorefront
  // ============================================

  describe("createStorefront", () => {
    it("should create storefront with minimal payload", async () => {
      const payload = B2CStorefrontFactory.createPayload();
      const result = await createStorefront(TEST_DB, payload);

      expect(result.name).toBe(payload.name);
      expect(result.slug).toBe(payload.slug);
      expect(result.domains).toEqual(
        payload.domains!.map((d: string) => d.toLowerCase())
      );
      expect(result.status).toBe("active");
      // Empty sub-documents may serialize as {} or undefined via .toObject()
      expect(result.branding ?? {}).toEqual(expect.objectContaining({}));
      expect(result.header ?? {}).toEqual(expect.objectContaining({}));
      expect(result.footer ?? {}).toEqual(expect.objectContaining({}));
    });

    it("should initialize home template on creation", async () => {
      const payload = B2CStorefrontFactory.createPayload();
      await createStorefront(TEST_DB, payload);

      expect(initB2CHomeTemplate).toHaveBeenCalledWith(
        payload.slug,
        payload.name,
        TEST_DB
      );
    });

    it("should create storefront with branding", async () => {
      const payload = B2CStorefrontFactory.createWithBranding();
      const result = await createStorefront(TEST_DB, payload);

      expect(result.branding.title).toBe("Test Brand");
      expect(result.branding.logo_url).toBe("https://example.com/logo.svg");
      expect(result.branding.favicon_url).toBe("https://example.com/favicon.ico");
      expect(result.branding.primary_color).toBe("#009688");
      expect(result.branding.secondary_color).toBe("#00796b");
      expect(result.branding.accent_color).toBe("#ff5722");
      expect(result.branding.font_family).toBe("Inter");
    });

    it("should create storefront with full config (branding + header + footer)", async () => {
      const payload = B2CStorefrontFactory.createFull();
      const result = await createStorefront(TEST_DB, payload);

      // Branding
      expect(result.branding.title).toBe("Test Brand");

      // Header
      expect(result.header.announcement_enabled).toBe(true);
      expect(result.header.announcement_text).toBe("Free shipping over €50");
      expect(result.header.nav_links).toHaveLength(2);
      expect(result.header.nav_links![0].label).toBe("Shop");
      expect(result.header.nav_links![1].open_in_new_tab).toBe(true);
      expect(result.header.show_search).toBe(true);
      expect(result.header.show_cart).toBe(true);
      expect(result.header.show_account).toBe(false);

      // Footer
      expect(result.footer.columns).toHaveLength(1);
      expect(result.footer.columns![0].title).toBe("Company");
      expect(result.footer.columns![0].links).toHaveLength(1);
      expect(result.footer.social_links).toHaveLength(1);
      expect(result.footer.social_links![0].platform).toBe("instagram");
      expect(result.footer.copyright_text).toBe("© 2026 Test Company");
      expect(result.footer.show_newsletter).toBe(true);
      expect(result.footer.bg_color).toBe("#1a1a1a");
      expect(result.footer.text_color).toBe("#ffffff");
    });

    it("should reject duplicate slug", async () => {
      const payload = B2CStorefrontFactory.createPayload({ slug: "my-shop" });
      await createStorefront(TEST_DB, payload);

      await expect(
        createStorefront(TEST_DB, { ...payload, name: "Another Store", domains: [] })
      ).rejects.toThrow('already exists');
    });

    it("should reject conflicting domain", async () => {
      await createStorefront(TEST_DB, {
        name: "Shop A",
        slug: "shop-a",
        domains: ["shop.example.com"],
      });

      await expect(
        createStorefront(TEST_DB, {
          name: "Shop B",
          slug: "shop-b",
          domains: ["shop.example.com"],
        })
      ).rejects.toThrow("already assigned");
    });

    it("should normalize domains to lowercase", async () => {
      const result = await createStorefront(TEST_DB, {
        name: "Test",
        slug: "test-norm",
        domains: ["SHOP.Example.COM", "  www.example.com  "],
      });

      expect(result.domains).toEqual(["shop.example.com", "www.example.com"]);
    });
  });

  // ============================================
  // updateStorefront
  // ============================================

  describe("updateStorefront", () => {
    it("should update name", async () => {
      const payload = B2CStorefrontFactory.createPayload({ slug: "upd-name" });
      await createStorefront(TEST_DB, payload);

      const updated = await updateStorefront(TEST_DB, "upd-name", {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    });

    it("should update branding fields (merge, not replace)", async () => {
      const payload = B2CStorefrontFactory.createWithBranding({ slug: "upd-brand" });
      await createStorefront(TEST_DB, payload);

      const updated = await updateStorefront(TEST_DB, "upd-brand", {
        branding: { primary_color: "#ff0000" },
      });

      expect(updated.branding.primary_color).toBe("#ff0000");
      // Original fields should still be present via merge
      expect(updated.branding.title).toBe("Test Brand");
    });

    it("should update header config", async () => {
      const payload = B2CStorefrontFactory.createPayload({ slug: "upd-header" });
      await createStorefront(TEST_DB, payload);

      const updated = await updateStorefront(TEST_DB, "upd-header", {
        header: {
          announcement_enabled: true,
          announcement_text: "Big Sale!",
          nav_links: [{ label: "Sale", href: "/sale" }],
          show_cart: false,
        },
      });

      expect(updated.header.announcement_enabled).toBe(true);
      expect(updated.header.announcement_text).toBe("Big Sale!");
      expect(updated.header.nav_links).toHaveLength(1);
      expect(updated.header.show_cart).toBe(false);
    });

    it("should update footer columns and social links", async () => {
      const payload = B2CStorefrontFactory.createPayload({ slug: "upd-footer" });
      await createStorefront(TEST_DB, payload);

      const updated = await updateStorefront(TEST_DB, "upd-footer", {
        footer: {
          columns: [
            { title: "Help", links: [{ label: "FAQ", href: "/faq" }] },
            { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }] },
          ],
          social_links: [
            { platform: "facebook", url: "https://facebook.com/test" },
            { platform: "linkedin", url: "https://linkedin.com/test" },
          ],
          copyright_text: "© 2026 Updated Corp",
        },
      });

      expect(updated.footer.columns).toHaveLength(2);
      expect(updated.footer.columns![0].title).toBe("Help");
      expect(updated.footer.columns![1].links[0].label).toBe("Privacy");
      expect(updated.footer.social_links).toHaveLength(2);
      expect(updated.footer.copyright_text).toBe("© 2026 Updated Corp");
    });

    it("should reject domain conflict with other storefront", async () => {
      await createStorefront(TEST_DB, {
        name: "Store 1",
        slug: "store-one",
        domains: ["taken.example.com"],
      });
      await createStorefront(TEST_DB, {
        name: "Store 2",
        slug: "store-two",
        domains: ["other.example.com"],
      });

      await expect(
        updateStorefront(TEST_DB, "store-two", {
          domains: ["taken.example.com"],
        })
      ).rejects.toThrow("already assigned");
    });

    it("should allow keeping own domains on update", async () => {
      await createStorefront(TEST_DB, {
        name: "Store",
        slug: "store-own",
        domains: ["mine.example.com"],
      });

      // Updating same domain on same storefront should not conflict
      const updated = await updateStorefront(TEST_DB, "store-own", {
        domains: ["mine.example.com", "new.example.com"],
      });

      expect(updated.domains).toContain("mine.example.com");
      expect(updated.domains).toContain("new.example.com");
    });

    it("should throw for non-existent storefront", async () => {
      await expect(
        updateStorefront(TEST_DB, "nonexistent", { name: "X" })
      ).rejects.toThrow("not found");
    });
  });

  // ============================================
  // deleteStorefront
  // ============================================

  describe("deleteStorefront", () => {
    it("should delete storefront and its templates", async () => {
      await createStorefront(TEST_DB, {
        name: "To Delete",
        slug: "to-delete",
      });

      await deleteStorefront(TEST_DB, "to-delete");

      expect(deleteB2CHomeTemplates).toHaveBeenCalledWith("to-delete", TEST_DB);

      const found = await getStorefrontBySlug(TEST_DB, "to-delete");
      expect(found).toBeNull();
    });

    it("should throw for non-existent storefront", async () => {
      await expect(
        deleteStorefront(TEST_DB, "nonexistent")
      ).rejects.toThrow("not found");
    });
  });

  // ============================================
  // listStorefronts
  // ============================================

  describe("listStorefronts", () => {
    it("should return paginated results", async () => {
      // Create 3 storefronts
      for (let i = 0; i < 3; i++) {
        await createStorefront(TEST_DB, {
          name: `Store ${i}`,
          slug: `list-store-${i}`,
          domains: [],
        });
      }

      const result = await listStorefronts(TEST_DB, { page: 1, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter by search term", async () => {
      await createStorefront(TEST_DB, {
        name: "Alpha Store",
        slug: "alpha-store",
        domains: [],
      });
      await createStorefront(TEST_DB, {
        name: "Beta Store",
        slug: "beta-store",
        domains: [],
      });

      const result = await listStorefronts(TEST_DB, { search: "Alpha" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Alpha Store");
    });

    it("should search by domain", async () => {
      await createStorefront(TEST_DB, {
        name: "Domain Store",
        slug: "domain-store",
        domains: ["unique-domain.com"],
      });
      await createStorefront(TEST_DB, {
        name: "Other Store",
        slug: "other-store",
        domains: ["other.com"],
      });

      const result = await listStorefronts(TEST_DB, { search: "unique-domain" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe("domain-store");
    });
  });

  // ============================================
  // getStorefrontByDomain
  // ============================================

  describe("getStorefrontByDomain", () => {
    it("should find active storefront by domain", async () => {
      await createStorefront(TEST_DB, {
        name: "By Domain",
        slug: "by-domain",
        domains: ["shop.test.com"],
      });

      const found = await getStorefrontByDomain(TEST_DB, "shop.test.com");

      expect(found).not.toBeNull();
      expect(found!.slug).toBe("by-domain");
    });

    it("should not find inactive storefront", async () => {
      await createStorefront(TEST_DB, {
        name: "Inactive",
        slug: "inactive-sf",
        domains: ["inactive.test.com"],
      });
      await updateStorefront(TEST_DB, "inactive-sf", { status: "inactive" });

      const found = await getStorefrontByDomain(TEST_DB, "inactive.test.com");

      expect(found).toBeNull();
    });

    it("should return null for unknown domain", async () => {
      const found = await getStorefrontByDomain(TEST_DB, "unknown.test.com");
      expect(found).toBeNull();
    });

    it("should match domain case-insensitively", async () => {
      await createStorefront(TEST_DB, {
        name: "Case Test",
        slug: "case-test",
        domains: ["shop.case.com"],
      });

      const found = await getStorefrontByDomain(TEST_DB, "SHOP.CASE.COM");

      expect(found).not.toBeNull();
      expect(found!.slug).toBe("case-test");
    });
  });

  // ============================================
  // getStorefrontBySlug
  // ============================================

  describe("getStorefrontBySlug", () => {
    it("should return storefront with all fields", async () => {
      const payload = B2CStorefrontFactory.createFull({ slug: "full-slug" });
      await createStorefront(TEST_DB, payload);

      const found = await getStorefrontBySlug(TEST_DB, "full-slug");

      expect(found).not.toBeNull();
      expect(found!.branding.title).toBe("Test Brand");
      expect(found!.header.nav_links).toHaveLength(2);
      expect(found!.footer.columns).toHaveLength(1);
      expect(found!.footer.social_links).toHaveLength(1);
    });

    it("should return null for unknown slug", async () => {
      const found = await getStorefrontBySlug(TEST_DB, "nonexistent");
      expect(found).toBeNull();
    });
  });
});
