/**
 * Unit Tests for Features and Product Types
 *
 * Tests feature structure, product type structure, validation, and business logic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  FeatureFactory,
  ProductTypeFactory,
} from "../conftest";

// ============================================
// TEST SETUP
// ============================================

describe("unit: Features and Product Types", () => {
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
  // Feature Factory Tests
  // ==========================================

  describe("FeatureFactory", () => {
    it("should create feature with default values", () => {
      /**
       * Test factory creates valid feature structure.
       */
      const feature = FeatureFactory.createPayload();

      expect(feature.feature_id).toBeDefined();
      expect(feature.key).toBeDefined();
      expect(feature.label).toBeDefined();
      expect(feature.type).toBe("text");
      expect(feature.default_required).toBe(false);
      expect(feature.display_order).toBe(0);
      expect(feature.is_active).toBe(true);
    });

    it("should create number feature with UOM", () => {
      /**
       * Test factory creates number feature with unit of measurement.
       */
      const feature = FeatureFactory.createNumberFeature();

      expect(feature.key).toBe("diameter");
      expect(feature.label).toBe("Diameter");
      expect(feature.type).toBe("number");
      expect(feature.uom_id).toBe("mm-001");
      expect(feature.uom).toBeDefined();
      expect(feature.uom?.symbol).toBe("mm");
      expect(feature.uom?.category).toBe("length");
      expect(feature.default_required).toBe(true);
    });

    it("should create select feature with options", () => {
      /**
       * Test factory creates select feature with predefined options.
       */
      const feature = FeatureFactory.createSelectFeature();

      expect(feature.key).toBe("material");
      expect(feature.type).toBe("select");
      expect(feature.options).toHaveLength(4);
      expect(feature.options).toContain("Steel");
      expect(feature.options).toContain("Brass");
    });

    it("should create multiselect feature with options", () => {
      /**
       * Test factory creates multiselect feature with multiple options.
       */
      const feature = FeatureFactory.createMultiselectFeature();

      expect(feature.key).toBe("certifications");
      expect(feature.type).toBe("multiselect");
      expect(feature.options).toContain("CE");
      expect(feature.options).toContain("FDA");
    });

    it("should create boolean feature", () => {
      /**
       * Test factory creates boolean feature.
       */
      const feature = FeatureFactory.createBooleanFeature();

      expect(feature.key).toBe("fda_approved");
      expect(feature.type).toBe("boolean");
      expect(feature.default_required).toBe(false);
    });

    it("should create inactive feature", () => {
      /**
       * Test factory creates inactive feature.
       */
      const feature = FeatureFactory.createInactive();

      expect(feature.is_active).toBe(false);
    });

    it("should allow overrides", () => {
      /**
       * Test factory accepts custom overrides.
       */
      const feature = FeatureFactory.createPayload({
        key: "custom_key",
        label: "Custom Label",
        type: "number",
        default_required: true,
      });

      expect(feature.key).toBe("custom_key");
      expect(feature.label).toBe("Custom Label");
      expect(feature.type).toBe("number");
      expect(feature.default_required).toBe(true);
    });
  });

  // ==========================================
  // Product Type Factory Tests
  // ==========================================

  describe("ProductTypeFactory", () => {
    it("should create product type with default values", () => {
      /**
       * Test factory creates valid product type structure.
       */
      const productType = ProductTypeFactory.createPayload();

      expect(productType.product_type_id).toBeDefined();
      expect(productType.name).toBeDefined();
      expect(productType.slug).toBeDefined();
      expect(productType.description).toBeDefined();
      expect(productType.features).toEqual([]);
      expect(productType.display_order).toBe(0);
      expect(productType.is_active).toBe(true);
      expect(productType.product_count).toBe(0);
    });

    it("should create product type with features", () => {
      /**
       * Test factory creates product type with feature references.
       */
      const featureIds = ["feature-1", "feature-2", "feature-3"];
      const productType = ProductTypeFactory.createWithFeatures(featureIds);

      expect(productType.features).toHaveLength(3);
      expect(productType.features[0].feature_id).toBe("feature-1");
      expect(productType.features[0].required).toBe(true); // First is required
      expect(productType.features[1].required).toBe(false); // Others are optional
      expect(productType.features[2].required).toBe(false);
    });

    it("should create water meter product type", () => {
      /**
       * Test factory creates water meter type.
       */
      const productType = ProductTypeFactory.createWaterMeter(["f1", "f2"]);

      expect(productType.name).toBe("Water Meter");
      expect(productType.slug).toBe("water-meter");
      expect(productType.features).toHaveLength(2);
      expect(productType.features[0].required).toBe(true);
      expect(productType.features[1].required).toBe(true);
    });

    it("should create valve product type", () => {
      /**
       * Test factory creates valve type with mixed required/optional.
       */
      const productType = ProductTypeFactory.createValve(["f1", "f2", "f3"]);

      expect(productType.name).toBe("Valve");
      expect(productType.slug).toBe("valve");
      expect(productType.features).toHaveLength(3);
      expect(productType.features[0].required).toBe(true);
      expect(productType.features[1].required).toBe(true);
      expect(productType.features[2].required).toBe(false);
    });

    it("should create inactive product type", () => {
      /**
       * Test factory creates inactive product type.
       */
      const productType = ProductTypeFactory.createInactive();

      expect(productType.is_active).toBe(false);
    });

    it("should allow overrides", () => {
      /**
       * Test factory accepts custom overrides.
       */
      const productType = ProductTypeFactory.createPayload({
        name: "Custom Type",
        slug: "custom-type",
        product_count: 10,
      });

      expect(productType.name).toBe("Custom Type");
      expect(productType.slug).toBe("custom-type");
      expect(productType.product_count).toBe(10);
    });
  });

  // ==========================================
  // Feature Type Validation Tests
  // ==========================================

  describe("feature types", () => {
    const validTypes = ["text", "number", "select", "multiselect", "boolean"];

    it("should support all valid feature types", () => {
      /**
       * Test all valid feature types can be created.
       */
      validTypes.forEach((type) => {
        const feature = FeatureFactory.createPayload({ type });
        expect(feature.type).toBe(type);
      });
    });

    it("should have options for select type", () => {
      /**
       * Test select type should have options array.
       */
      const feature = FeatureFactory.createSelectFeature();
      expect(feature.type).toBe("select");
      expect(Array.isArray(feature.options)).toBe(true);
      expect(feature.options!.length).toBeGreaterThan(0);
    });

    it("should have options for multiselect type", () => {
      /**
       * Test multiselect type should have options array.
       */
      const feature = FeatureFactory.createMultiselectFeature();
      expect(feature.type).toBe("multiselect");
      expect(Array.isArray(feature.options)).toBe(true);
      expect(feature.options!.length).toBeGreaterThan(0);
    });

    it("should have UOM for numeric features", () => {
      /**
       * Test number features should have unit of measurement.
       */
      const feature = FeatureFactory.createNumberFeature();
      expect(feature.type).toBe("number");
      expect(feature.uom_id).toBeDefined();
      expect(feature.uom).toBeDefined();
    });
  });

  // ==========================================
  // Feature Required State Tests
  // ==========================================

  describe("feature required state", () => {
    it("should default to not required", () => {
      /**
       * Test default_required defaults to false.
       */
      const feature = FeatureFactory.createPayload();
      expect(feature.default_required).toBe(false);
    });

    it("should allow setting required", () => {
      /**
       * Test features can be set as required.
       */
      const feature = FeatureFactory.createPayload({ default_required: true });
      expect(feature.default_required).toBe(true);
    });

    it("should preserve required state in product types", () => {
      /**
       * Test product type can override feature required state.
       */
      const productType = ProductTypeFactory.createWithFeatures(["f1", "f2"]);

      // First feature is required, second is optional
      expect(productType.features[0].required).toBe(true);
      expect(productType.features[1].required).toBe(false);
    });
  });

  // ==========================================
  // Feature Active State Tests
  // ==========================================

  describe("feature active state", () => {
    it("should default to active", () => {
      /**
       * Test is_active defaults to true.
       */
      const feature = FeatureFactory.createPayload();
      expect(feature.is_active).toBe(true);
    });

    it("should allow creating inactive feature", () => {
      /**
       * Test inactive features can be created.
       */
      const feature = FeatureFactory.createInactive();
      expect(feature.is_active).toBe(false);
    });

    it("should filter active features", () => {
      /**
       * Test filtering features by active status.
       */
      const features = [
        FeatureFactory.createPayload({ is_active: true }),
        FeatureFactory.createPayload({ is_active: true }),
        FeatureFactory.createInactive(),
      ];

      const activeFeatures = features.filter((f) => f.is_active);
      const inactiveFeatures = features.filter((f) => !f.is_active);

      expect(activeFeatures).toHaveLength(2);
      expect(inactiveFeatures).toHaveLength(1);
    });
  });

  // ==========================================
  // Product Type Features Tests
  // ==========================================

  describe("product type features", () => {
    it("should have empty features by default", () => {
      /**
       * Test product type starts with no features.
       */
      const productType = ProductTypeFactory.createPayload();
      expect(productType.features).toEqual([]);
    });

    it("should maintain feature display order", () => {
      /**
       * Test features maintain their display order.
       */
      const productType = ProductTypeFactory.createWithFeatures([
        "first",
        "second",
        "third",
      ]);

      expect(productType.features[0].display_order).toBe(0);
      expect(productType.features[1].display_order).toBe(1);
      expect(productType.features[2].display_order).toBe(2);
    });

    it("should allow adding feature reference", () => {
      /**
       * Test adding a feature reference to product type.
       */
      const productType = ProductTypeFactory.createPayload();
      const featureRef = {
        feature_id: "test-feature-id",
        required: true,
        display_order: 0,
      };

      productType.features.push(featureRef);

      expect(productType.features).toHaveLength(1);
      expect(productType.features[0].feature_id).toBe("test-feature-id");
    });

    it("should count required features", () => {
      /**
       * Test counting required vs optional features.
       */
      const productType = ProductTypeFactory.createValve(["f1", "f2", "f3"]);

      const requiredFeatures = productType.features.filter((f) => f.required);
      const optionalFeatures = productType.features.filter((f) => !f.required);

      expect(requiredFeatures).toHaveLength(2);
      expect(optionalFeatures).toHaveLength(1);
    });
  });

  // ==========================================
  // Product Type Active State Tests
  // ==========================================

  describe("product type active state", () => {
    it("should default to active", () => {
      /**
       * Test is_active defaults to true.
       */
      const productType = ProductTypeFactory.createPayload();
      expect(productType.is_active).toBe(true);
    });

    it("should filter active product types", () => {
      /**
       * Test filtering product types by active status.
       */
      const types = [
        ProductTypeFactory.createPayload({ is_active: true }),
        ProductTypeFactory.createPayload({ is_active: true }),
        ProductTypeFactory.createInactive(),
      ];

      const activeTypes = types.filter((t) => t.is_active);
      const inactiveTypes = types.filter((t) => !t.is_active);

      expect(activeTypes).toHaveLength(2);
      expect(inactiveTypes).toHaveLength(1);
    });
  });

  // ==========================================
  // Product Count Tests
  // ==========================================

  describe("product count", () => {
    it("should default to zero", () => {
      /**
       * Test product_count defaults to 0.
       */
      const productType = ProductTypeFactory.createPayload();
      expect(productType.product_count).toBe(0);
    });

    it("should allow setting product count", () => {
      /**
       * Test product_count can be set.
       */
      const productType = ProductTypeFactory.createPayload({ product_count: 25 });
      expect(productType.product_count).toBe(25);
    });
  });

  // ==========================================
  // Display Order Tests
  // ==========================================

  describe("display order", () => {
    it("should default to zero for features", () => {
      /**
       * Test feature display_order defaults to 0.
       */
      const feature = FeatureFactory.createPayload();
      expect(feature.display_order).toBe(0);
    });

    it("should default to zero for product types", () => {
      /**
       * Test product type display_order defaults to 0.
       */
      const productType = ProductTypeFactory.createPayload();
      expect(productType.display_order).toBe(0);
    });

    it("should sort features by display order", () => {
      /**
       * Test features can be sorted by display_order.
       */
      const features = [
        FeatureFactory.createPayload({ display_order: 2 }),
        FeatureFactory.createPayload({ display_order: 0 }),
        FeatureFactory.createPayload({ display_order: 1 }),
      ];

      const sorted = [...features].sort((a, b) => a.display_order - b.display_order);

      expect(sorted[0].display_order).toBe(0);
      expect(sorted[1].display_order).toBe(1);
      expect(sorted[2].display_order).toBe(2);
    });

    it("should sort product types by display order", () => {
      /**
       * Test product types can be sorted by display_order.
       */
      const types = [
        ProductTypeFactory.createPayload({ display_order: 5 }),
        ProductTypeFactory.createPayload({ display_order: 1 }),
        ProductTypeFactory.createPayload({ display_order: 3 }),
      ];

      const sorted = [...types].sort((a, b) => a.display_order - b.display_order);

      expect(sorted[0].display_order).toBe(1);
      expect(sorted[1].display_order).toBe(3);
      expect(sorted[2].display_order).toBe(5);
    });
  });

  // ==========================================
  // UOM Integration Tests
  // ==========================================

  describe("UOM integration", () => {
    it("should support uom_id reference", () => {
      /**
       * Test feature can reference UOM by ID.
       */
      const feature = FeatureFactory.createPayload({
        type: "number",
        uom_id: "bar-001",
      });

      expect(feature.uom_id).toBe("bar-001");
    });

    it("should support embedded UOM data", () => {
      /**
       * Test feature can have embedded UOM data for display.
       */
      const feature = FeatureFactory.createNumberFeature();

      expect(feature.uom).toBeDefined();
      expect(feature.uom?.uom_id).toBe("mm-001");
      expect(feature.uom?.symbol).toBe("mm");
      expect(feature.uom?.name).toBe("Millimeter");
      expect(feature.uom?.category).toBe("length");
    });

    it("should support legacy unit field", () => {
      /**
       * Test backward compatibility with legacy unit field.
       */
      const feature = FeatureFactory.createPayload({
        type: "number",
        unit: "mm", // Legacy field
      });

      expect(feature.unit).toBe("mm");
    });
  });

  // ==========================================
  // Key/Slug Uniqueness Tests
  // ==========================================

  describe("key/slug uniqueness", () => {
    it("should generate unique feature keys", () => {
      /**
       * Test factory generates unique feature keys.
       */
      const feature1 = FeatureFactory.createPayload();
      const feature2 = FeatureFactory.createPayload();

      expect(feature1.key).not.toBe(feature2.key);
    });

    it("should generate unique product type slugs", () => {
      /**
       * Test factory generates unique product type slugs.
       */
      const type1 = ProductTypeFactory.createPayload();
      const type2 = ProductTypeFactory.createPayload();

      expect(type1.slug).not.toBe(type2.slug);
    });

    it("should generate unique feature IDs", () => {
      /**
       * Test factory generates unique feature IDs.
       */
      const feature1 = FeatureFactory.createPayload();
      const feature2 = FeatureFactory.createPayload();

      expect(feature1.feature_id).not.toBe(feature2.feature_id);
    });

    it("should generate unique product type IDs", () => {
      /**
       * Test factory generates unique product type IDs.
       */
      const type1 = ProductTypeFactory.createPayload();
      const type2 = ProductTypeFactory.createPayload();

      expect(type1.product_type_id).not.toBe(type2.product_type_id);
    });
  });

  // ==========================================
  // Feature Value Handling Tests
  // ==========================================

  describe("feature value handling", () => {
    it("should support text values", () => {
      /**
       * Test text feature value structure.
       */
      const feature = FeatureFactory.createPayload({ type: "text" });
      const featureValue = { key: feature.key, value: "Test Value" };

      expect(featureValue.value).toBe("Test Value");
    });

    it("should support number values", () => {
      /**
       * Test number feature value structure.
       */
      const feature = FeatureFactory.createNumberFeature();
      const featureValue = { key: feature.key, value: 25.5, unit: "mm" };

      expect(featureValue.value).toBe(25.5);
      expect(featureValue.unit).toBe("mm");
    });

    it("should support boolean values", () => {
      /**
       * Test boolean feature value structure.
       */
      const feature = FeatureFactory.createBooleanFeature();
      const featureValue = { key: feature.key, value: true };

      expect(featureValue.value).toBe(true);
    });

    it("should support select values", () => {
      /**
       * Test select feature value structure.
       */
      const feature = FeatureFactory.createSelectFeature();
      const featureValue = { key: feature.key, value: "Steel" };

      expect(feature.options).toContain(featureValue.value);
    });

    it("should support multiselect values", () => {
      /**
       * Test multiselect feature value structure.
       */
      const feature = FeatureFactory.createMultiselectFeature();
      const featureValue = { key: feature.key, value: ["CE", "FDA"] };

      expect(Array.isArray(featureValue.value)).toBe(true);
      featureValue.value.forEach((v) => {
        expect(feature.options).toContain(v);
      });
    });
  });
});
