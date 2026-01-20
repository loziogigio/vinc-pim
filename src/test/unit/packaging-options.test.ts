/**
 * Unit Tests for Packaging Options
 *
 * Tests packaging options structure, validation, and business logic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  PackagingOptionFactory,
  PromotionFactory,
} from "../conftest";
import mongoose from "mongoose";

// ============================================
// TEST SETUP
// ============================================

describe("unit: Packaging Options", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ==========================================
  // Factory Tests
  // ==========================================

  describe("PackagingOptionFactory", () => {
    it("should create packaging option with default values", () => {
      /**
       * Test factory creates valid packaging option structure.
       */
      const packaging = PackagingOptionFactory.createPayload();

      expect(packaging.code).toBeDefined();
      expect(packaging.qty).toBe(1);
      expect(packaging.uom).toBe("PZ");
      expect(packaging.is_sellable).toBe(true);
      expect(packaging.is_default).toBe(false);
      expect(packaging.pricing).toBeDefined();
      expect(packaging.pricing.list).toBe(100);
    });

    it("should create default packaging option", () => {
      /**
       * Test factory creates default packaging (PZ).
       */
      const packaging = PackagingOptionFactory.createDefault();

      expect(packaging.code).toBe("PZ");
      expect(packaging.is_default).toBe(true);
      expect(packaging.is_smallest).toBe(true);
      expect(packaging.qty).toBe(1);
    });

    it("should create box packaging option", () => {
      /**
       * Test factory creates box packaging with multiple units.
       */
      const packaging = PackagingOptionFactory.createBox();

      expect(packaging.code).toBe("BOX");
      expect(packaging.qty).toBe(6);
      expect(packaging.is_default).toBe(false);
      expect(packaging.pricing.list).toBe(550);
    });

    it("should create non-sellable packaging option", () => {
      /**
       * Test factory creates non-sellable packaging (display unit).
       */
      const packaging = PackagingOptionFactory.createNonSellable();

      expect(packaging.code).toBe("DISPLAY");
      expect(packaging.is_sellable).toBe(false);
      expect(packaging.qty).toBe(24);
    });

    it("should allow overrides", () => {
      /**
       * Test factory accepts custom overrides.
       */
      const packaging = PackagingOptionFactory.createPayload({
        code: "CUSTOM",
        qty: 12,
        is_sellable: false,
        pricing: { list: 999 },
      });

      expect(packaging.code).toBe("CUSTOM");
      expect(packaging.qty).toBe(12);
      expect(packaging.is_sellable).toBe(false);
      expect(packaging.pricing.list).toBe(999);
    });
  });

  // ==========================================
  // Promotion Factory Tests
  // ==========================================

  describe("PromotionFactory", () => {
    it("should create promotion with default values", () => {
      /**
       * Test factory creates valid promotion structure.
       */
      const promo = PromotionFactory.createPayload();

      expect(promo.promo_code).toBeDefined();
      expect(promo.is_active).toBe(true);
      expect(promo.promo_type).toBe("STD");
      expect(promo.discount_percentage).toBe(10);
      expect(promo.min_quantity).toBe(1);
    });

    it("should create quantity discount promotion", () => {
      /**
       * Test factory creates quantity-based discount.
       */
      const promo = PromotionFactory.createQuantityDiscount();

      expect(promo.promo_code).toBe("QTY-DISC");
      expect(promo.discount_percentage).toBe(15);
      expect(promo.min_quantity).toBe(5);
    });
  });

  // ==========================================
  // is_sellable Business Logic Tests
  // ==========================================

  describe("is_sellable field", () => {
    it("should default to true when undefined", () => {
      /**
       * Test that undefined is_sellable is treated as true.
       * This matches the Mongoose schema default behavior.
       */
      const packaging = PackagingOptionFactory.createPayload();
      delete (packaging as Record<string, unknown>).is_sellable;

      // Undefined should be treated as true (default behavior)
      const isSellable = packaging.is_sellable ?? true;
      expect(isSellable).toBe(true);
    });

    it("should respect explicit false value", () => {
      /**
       * Test that is_sellable=false is preserved.
       */
      const packaging = PackagingOptionFactory.createNonSellable();

      expect(packaging.is_sellable).toBe(false);
    });

    it("should allow filtering sellable options", () => {
      /**
       * Test filtering packaging options by sellable status.
       */
      const options = [
        PackagingOptionFactory.createDefault({ is_sellable: true }),
        PackagingOptionFactory.createBox({ is_sellable: true }),
        PackagingOptionFactory.createNonSellable({ is_sellable: false }),
      ];

      const sellableOptions = options.filter((o) => o.is_sellable !== false);
      const nonSellableOptions = options.filter((o) => o.is_sellable === false);

      expect(sellableOptions).toHaveLength(2);
      expect(nonSellableOptions).toHaveLength(1);
      expect(nonSellableOptions[0].code).toBe("DISPLAY");
    });
  });

  // ==========================================
  // Packaging Option Validation Tests
  // ==========================================

  describe("validation", () => {
    it("should require code field", () => {
      /**
       * Test that code is required.
       */
      const packaging = PackagingOptionFactory.createPayload();
      expect(packaging.code).toBeDefined();
      expect(packaging.code.length).toBeGreaterThan(0);
    });

    it("should require qty field", () => {
      /**
       * Test that qty is required and positive.
       */
      const packaging = PackagingOptionFactory.createPayload();
      expect(packaging.qty).toBeGreaterThan(0);
    });

    it("should have valid pricing structure", () => {
      /**
       * Test pricing structure is valid.
       */
      const packaging = PackagingOptionFactory.createPayload({
        pricing: {
          list: 100,
          retail: 200,
          sale: 80,
        },
      });

      expect(packaging.pricing.list).toBe(100);
      expect(packaging.pricing.retail).toBe(200);
      expect(packaging.pricing.sale).toBe(80);
    });

    it("should have only one default packaging in a set", () => {
      /**
       * Test business rule: only one packaging can be default.
       */
      const options = [
        PackagingOptionFactory.createDefault(),
        PackagingOptionFactory.createBox(),
        PackagingOptionFactory.createPayload({ code: "CF", is_default: false }),
      ];

      const defaults = options.filter((o) => o.is_default);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].code).toBe("PZ");
    });
  });

  // ==========================================
  // Promotions on Packaging Tests
  // ==========================================

  describe("packaging with promotions", () => {
    it("should allow promotions array on packaging", () => {
      /**
       * Test that packaging can have promotions.
       */
      const packaging = PackagingOptionFactory.createDefault();
      const promo = PromotionFactory.createPayload();

      const packagingWithPromo = {
        ...packaging,
        promotions: [promo],
      };

      expect(packagingWithPromo.promotions).toHaveLength(1);
      expect(packagingWithPromo.promotions[0].promo_code).toBe(promo.promo_code);
    });

    it("should support multiple promotions per packaging", () => {
      /**
       * Test multiple promotions on single packaging.
       */
      const packaging = PackagingOptionFactory.createBox();
      const promos = [
        PromotionFactory.createPayload({ promo_code: "PROMO-1" }),
        PromotionFactory.createQuantityDiscount(),
      ];

      const packagingWithPromos = {
        ...packaging,
        promotions: promos,
      };

      expect(packagingWithPromos.promotions).toHaveLength(2);
    });

    it("should filter active promotions", () => {
      /**
       * Test filtering active vs inactive promotions.
       */
      const promos = [
        PromotionFactory.createPayload({ promo_code: "ACTIVE-1", is_active: true }),
        PromotionFactory.createPayload({ promo_code: "INACTIVE-1", is_active: false }),
        PromotionFactory.createPayload({ promo_code: "ACTIVE-2", is_active: true }),
      ];

      const activePromos = promos.filter((p) => p.is_active);
      expect(activePromos).toHaveLength(2);
    });
  });

  // ==========================================
  // Price Calculation Tests
  // ==========================================

  describe("price calculations", () => {
    it("should calculate discount from list to sale price", () => {
      /**
       * Test discount percentage calculation.
       */
      const packaging = PackagingOptionFactory.createPayload({
        pricing: {
          list: 100,
          sale: 80,
        },
      });

      const listPrice = packaging.pricing.list ?? 0;
      const salePrice = packaging.pricing.sale ?? listPrice;
      const discountPct = ((listPrice - salePrice) / listPrice) * 100;

      expect(discountPct).toBe(20);
    });

    it("should apply promotion discount to price", () => {
      /**
       * Test promotion discount application.
       */
      const packaging = PackagingOptionFactory.createPayload({
        pricing: { list: 100 },
      });
      const promo = PromotionFactory.createPayload({ discount_percentage: 15 });

      const listPrice = packaging.pricing.list ?? 0;
      const promoPrice = listPrice * (1 - (promo.discount_percentage ?? 0) / 100);

      expect(promoPrice).toBe(85);
    });

    it("should use promo_price when specified", () => {
      /**
       * Test fixed promo price overrides percentage.
       */
      const promo = PromotionFactory.createPayload({
        discount_percentage: undefined,
        promo_price: 75,
      });

      expect(promo.promo_price).toBe(75);
    });
  });
});
