/**
 * Unit Tests for Order Types Helper Functions
 *
 * Pure function tests - no database, no external dependencies.
 * Tests business logic for order calculations and validation.
 */

import { describe, it, expect } from "vitest";
import {
  calculateLineTotals,
  calculateTotalDiscountPercent,
  validateQuantity,
  getNextLineNumber,
  LineItem,
  DiscountTier,
} from "@/lib/types/order";

// ============================================
// calculateLineTotals
// ============================================

describe("unit: calculateLineTotals", () => {
  it("should calculate line totals correctly", () => {
    /**
     * Basic calculation test.
     * qty=10, list_price=100, unit_price=80, vat=22%
     * line_gross = 10 * 100 = 1000
     * line_net = 10 * 80 = 800
     * line_vat = 800 * 0.22 = 176
     * line_total = 800 + 176 = 976
     */
    // Arrange
    const quantity = 10;
    const list_price = 100;
    const unit_price = 80;
    const vat_rate = 22;

    // Act
    const result = calculateLineTotals(quantity, list_price, unit_price, vat_rate);

    // Assert
    expect(result.line_gross).toBe(1000);
    expect(result.line_net).toBe(800);
    expect(result.line_vat).toBe(176);
    expect(result.line_total).toBe(976);
  });

  it("should handle zero quantity", () => {
    /**
     * Edge case: zero quantity should return zero totals.
     */
    // Arrange & Act
    const result = calculateLineTotals(0, 100, 80, 22);

    // Assert
    expect(result.line_gross).toBe(0);
    expect(result.line_net).toBe(0);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(0);
  });

  it("should handle zero VAT rate", () => {
    /**
     * VAT-exempt products (vat_rate=0).
     */
    // Arrange & Act
    const result = calculateLineTotals(10, 100, 80, 0);

    // Assert
    expect(result.line_gross).toBe(1000);
    expect(result.line_net).toBe(800);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(800);
  });

  it("should handle different VAT rates (10%, 4%)", () => {
    /**
     * Test common Italian VAT rates.
     */
    // 10% VAT
    const result10 = calculateLineTotals(10, 100, 100, 10);
    expect(result10.line_vat).toBe(100); // 1000 * 0.10

    // 4% VAT (reduced rate)
    const result4 = calculateLineTotals(10, 100, 100, 4);
    expect(result4.line_vat).toBe(40); // 1000 * 0.04
  });

  it("should round to 2 decimal places", () => {
    /**
     * Ensure proper rounding for currency values.
     * qty=3, unit_price=0.1056, vat=22%
     * line_net = 3 * 0.1056 = 0.3168 → 0.32
     * line_vat = 0.32 * 0.22 = 0.0704 → 0.07
     */
    // Arrange & Act
    const result = calculateLineTotals(3, 0.21106, 0.1056, 22);

    // Assert - values should be rounded
    expect(result.line_net).toBe(0.32);
    expect(result.line_vat).toBe(0.07);
    expect(result.line_total).toBe(0.39);
  });

  it("should handle large quantities", () => {
    /**
     * B2B scenario: large wholesale orders.
     */
    // Arrange & Act
    const result = calculateLineTotals(10000, 0.50, 0.40, 22);

    // Assert
    expect(result.line_gross).toBe(5000);
    expect(result.line_net).toBe(4000);
    expect(result.line_vat).toBe(880);
    expect(result.line_total).toBe(4880);
  });

  it("should handle no discount (list_price === unit_price)", () => {
    /**
     * When there's no discount applied.
     */
    // Arrange & Act
    const result = calculateLineTotals(5, 100, 100, 22);

    // Assert
    expect(result.line_gross).toBe(500);
    expect(result.line_net).toBe(500);
    expect(result.line_gross).toBe(result.line_net);
  });

  it("should handle decimal quantities (kg, liters)", () => {
    /**
     * Some products are sold by weight/volume with decimal quantities.
     */
    // Arrange & Act
    const result = calculateLineTotals(2.5, 10, 8, 22);

    // Assert
    expect(result.line_gross).toBe(25);
    expect(result.line_net).toBe(20);
    expect(result.line_vat).toBe(4.4);
    expect(result.line_total).toBe(24.4);
  });
});

// ============================================
// calculateTotalDiscountPercent
// ============================================

describe("unit: calculateTotalDiscountPercent", () => {
  it("should return 0 for empty discounts", () => {
    /**
     * No discounts applied.
     */
    // Arrange & Act
    const result = calculateTotalDiscountPercent([]);

    // Assert
    expect(result).toBe(0);
  });

  it("should return 0 for null/undefined discounts", () => {
    /**
     * Defensive: handle null/undefined.
     */
    // @ts-expect-error Testing null handling
    expect(calculateTotalDiscountPercent(null)).toBe(0);
    // @ts-expect-error Testing undefined handling
    expect(calculateTotalDiscountPercent(undefined)).toBe(0);
  });

  it("should calculate single percentage discount", () => {
    /**
     * Single 50% discount.
     */
    // Arrange
    const discounts: DiscountTier[] = [
      { tier: 1, type: "percentage", value: -50 },
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert
    expect(result).toBe(50);
  });

  it("should calculate cascading percentage discounts", () => {
    /**
     * Cascading discounts: 50% + 10%
     * 100 * (1 - 0.50) = 50
     * 50 * (1 - 0.10) = 45
     * Total discount = 100 - 45 = 55%
     */
    // Arrange
    const discounts: DiscountTier[] = [
      { tier: 1, type: "percentage", value: -50 },
      { tier: 2, type: "percentage", value: -10 },
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert
    expect(result).toBe(55);
  });

  it("should apply discounts in tier order", () => {
    /**
     * Discounts should be sorted by tier and applied in order.
     */
    // Arrange - discounts in wrong order
    const discounts: DiscountTier[] = [
      { tier: 2, type: "percentage", value: -10 },
      { tier: 1, type: "percentage", value: -50 },
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert - should still calculate correctly
    expect(result).toBe(55);
  });

  it("should ignore non-percentage discount types", () => {
    /**
     * Only percentage discounts affect the percentage calculation.
     * Fixed and override discounts are handled differently.
     */
    // Arrange
    const discounts: DiscountTier[] = [
      { tier: 1, type: "percentage", value: -20 },
      { tier: 2, type: "fixed", value: -10 }, // Should be ignored
      { tier: 3, type: "override", value: 50 }, // Should be ignored
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert - only tier 1 percentage discount
    expect(result).toBe(20);
  });

  it("should handle small percentage discounts", () => {
    /**
     * Small discount percentages.
     */
    // Arrange
    const discounts: DiscountTier[] = [
      { tier: 1, type: "percentage", value: -5 },
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert
    expect(result).toBe(5);
  });

  it("should round to 2 decimal places", () => {
    /**
     * Ensure proper rounding for percentage values.
     */
    // Arrange - 33.33% + 33.33% cascading
    const discounts: DiscountTier[] = [
      { tier: 1, type: "percentage", value: -33.33 },
      { tier: 2, type: "percentage", value: -33.33 },
    ];

    // Act
    const result = calculateTotalDiscountPercent(discounts);

    // Assert - should be rounded
    expect(result).toBeCloseTo(55.55, 1);
  });
});

// ============================================
// validateQuantity
// ============================================

describe("unit: validateQuantity", () => {
  it("should return null for valid quantity", () => {
    /**
     * Valid quantity with no constraints.
     */
    // Arrange & Act
    const result = validateQuantity(10);

    // Assert
    expect(result).toBeNull();
  });

  it("should reject zero quantity", () => {
    /**
     * Zero quantity is invalid.
     */
    // Arrange & Act
    const result = validateQuantity(0);

    // Assert
    expect(result).toBe("Quantity must be greater than 0");
  });

  it("should reject negative quantity", () => {
    /**
     * Negative quantity is invalid.
     */
    // Arrange & Act
    const result = validateQuantity(-5);

    // Assert
    expect(result).toBe("Quantity must be greater than 0");
  });

  it("should validate minimum order quantity (MOQ)", () => {
    /**
     * Test MOQ validation.
     */
    // Below MOQ
    expect(validateQuantity(5, 10)).toBe("Minimum order quantity is 10");

    // At MOQ
    expect(validateQuantity(10, 10)).toBeNull();

    // Above MOQ
    expect(validateQuantity(15, 10)).toBeNull();
  });

  it("should validate pack size", () => {
    /**
     * Quantity must be multiple of pack size.
     */
    // Not a multiple
    expect(validateQuantity(5, undefined, 3)).toBe("Quantity must be a multiple of 3");

    // Exact multiple
    expect(validateQuantity(9, undefined, 3)).toBeNull();

    // Another valid multiple
    expect(validateQuantity(12, undefined, 4)).toBeNull();
  });

  it("should validate both MOQ and pack size", () => {
    /**
     * Combined validation: MOQ and pack size.
     */
    // MOQ=10, pack=5
    // Below MOQ
    expect(validateQuantity(5, 10, 5)).toBe("Minimum order quantity is 10");

    // At MOQ but not pack multiple (shouldn't happen in practice)
    expect(validateQuantity(12, 10, 5)).toBe("Quantity must be a multiple of 5");

    // Valid: at MOQ and pack multiple
    expect(validateQuantity(10, 10, 5)).toBeNull();

    // Valid: above MOQ and pack multiple
    expect(validateQuantity(15, 10, 5)).toBeNull();
  });

  it("should handle undefined MOQ and pack size", () => {
    /**
     * When MOQ and pack size are not specified.
     */
    // Arrange & Act
    const result = validateQuantity(1, undefined, undefined);

    // Assert
    expect(result).toBeNull();
  });

  it("should handle MOQ of 1", () => {
    /**
     * MOQ=1 should accept any positive quantity.
     */
    expect(validateQuantity(1, 1)).toBeNull();
    expect(validateQuantity(100, 1)).toBeNull();
  });

  it("should handle pack size of 1", () => {
    /**
     * Pack size=1 should accept any positive quantity.
     */
    expect(validateQuantity(1, undefined, 1)).toBeNull();
    expect(validateQuantity(7, undefined, 1)).toBeNull();
    expect(validateQuantity(100, undefined, 1)).toBeNull();
  });
});

// ============================================
// getNextLineNumber
// ============================================

describe("unit: getNextLineNumber", () => {
  it("should return 10 for empty items array", () => {
    /**
     * First item gets line_number 10.
     */
    // Arrange & Act
    const result = getNextLineNumber([]);

    // Assert
    expect(result).toBe(10);
  });

  it("should return 10 for null/undefined items array", () => {
    /**
     * Defensive: handle null/undefined.
     */
    // @ts-expect-error Testing null handling
    expect(getNextLineNumber(null)).toBe(10);
    // @ts-expect-error Testing undefined handling
    expect(getNextLineNumber(undefined)).toBe(10);
  });

  it("should return next multiple of 10", () => {
    /**
     * Line numbers increment by 10: 10, 20, 30...
     */
    // Arrange
    const items = [
      { line_number: 10 },
      { line_number: 20 },
    ] as LineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(30);
  });

  it("should handle gaps in line numbers", () => {
    /**
     * If items were deleted, gaps may exist.
     * Should still get max + 10.
     */
    // Arrange
    const items = [
      { line_number: 10 },
      { line_number: 40 }, // Gap: 20, 30 missing
    ] as LineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(50);
  });

  it("should handle single item", () => {
    /**
     * Single item case.
     */
    // Arrange
    const items = [{ line_number: 10 }] as LineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(20);
  });

  it("should handle unordered line numbers", () => {
    /**
     * Line numbers might not be in order.
     */
    // Arrange
    const items = [
      { line_number: 30 },
      { line_number: 10 },
      { line_number: 20 },
    ] as LineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(40);
  });

  it("should handle large line numbers", () => {
    /**
     * Orders with many items.
     */
    // Arrange
    const items = [
      { line_number: 990 },
      { line_number: 1000 },
    ] as LineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(1010);
  });
});
