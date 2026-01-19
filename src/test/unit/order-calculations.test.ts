/**
 * Unit Tests for Order Calculations
 *
 * Pure function tests - no database, no external dependencies.
 * Tests business logic for line item and order totals calculations.
 */

import { describe, it, expect } from "vitest";
import {
  calculateLineItemTotals,
  recalculateOrderTotals,
  getNextLineNumber,
  ILineItem,
  IOrder,
} from "@/lib/db/models/order";

// ============================================
// calculateLineItemTotals
// ============================================

describe("unit: calculateLineItemTotals", () => {
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
    const result = calculateLineItemTotals(quantity, list_price, unit_price, vat_rate);

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
    const result = calculateLineItemTotals(0, 100, 80, 22);

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
    const result = calculateLineItemTotals(10, 100, 80, 0);

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
    const result10 = calculateLineItemTotals(10, 100, 100, 10);
    expect(result10.line_vat).toBe(100); // 1000 * 0.10

    // 4% VAT (reduced rate)
    const result4 = calculateLineItemTotals(10, 100, 100, 4);
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
    const result = calculateLineItemTotals(3, 0.21106, 0.1056, 22);

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
    const result = calculateLineItemTotals(10000, 0.50, 0.40, 22);

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
    const result = calculateLineItemTotals(5, 100, 100, 22);

    // Assert
    expect(result.line_gross).toBe(500);
    expect(result.line_net).toBe(500);
    expect(result.line_gross).toBe(result.line_net);
  });
});

// ============================================
// recalculateOrderTotals
// ============================================

describe("unit: recalculateOrderTotals", () => {
  // Helper to create a mock order with items
  function createMockOrder(items: Partial<ILineItem>[]): IOrder {
    return {
      items: items.map((item, index) => ({
        line_number: (index + 1) * 10,
        entity_code: `PROD-${index}`,
        sku: `SKU-${index}`,
        quantity: 1,
        list_price: 100,
        unit_price: 100,
        vat_rate: 22,
        line_gross: item.line_gross ?? 100,
        line_net: item.line_net ?? 100,
        line_vat: item.line_vat ?? 22,
        line_total: item.line_total ?? 122,
        discounts: [],
        total_discount_percent: 0,
        is_gift_line: false,
        name: `Product ${index}`,
        added_at: new Date(),
        updated_at: new Date(),
        ...item,
      })) as ILineItem[],
      subtotal_gross: 0,
      subtotal_net: 0,
      total_discount: 0,
      total_vat: 0,
      shipping_cost: 0,
      order_total: 0,
    } as IOrder;
  }

  it("should calculate totals for single item", () => {
    /**
     * Single item order totals.
     */
    // Arrange
    const order = createMockOrder([
      { line_gross: 1000, line_net: 800, line_vat: 176 },
    ]);

    // Act
    recalculateOrderTotals(order);

    // Assert
    expect(order.subtotal_gross).toBe(1000);
    expect(order.subtotal_net).toBe(800);
    expect(order.total_discount).toBe(200); // 1000 - 800
    expect(order.total_vat).toBe(176);
    expect(order.order_total).toBe(976); // 800 + 176 + 0 shipping
  });

  it("should aggregate multiple items", () => {
    /**
     * Multiple items with different VAT rates.
     * Item 1: net=800, vat=176 (22%)
     * Item 2: net=250, vat=25 (10%)
     */
    // Arrange
    const order = createMockOrder([
      { line_gross: 1000, line_net: 800, line_vat: 176 },
      { line_gross: 300, line_net: 250, line_vat: 25 },
    ]);

    // Act
    recalculateOrderTotals(order);

    // Assert
    expect(order.subtotal_gross).toBe(1300);
    expect(order.subtotal_net).toBe(1050);
    expect(order.total_discount).toBe(250); // 1300 - 1050
    expect(order.total_vat).toBe(201);
    expect(order.order_total).toBe(1251);
  });

  it("should handle empty cart", () => {
    /**
     * Empty cart should have zero totals.
     */
    // Arrange
    const order = createMockOrder([]);

    // Act
    recalculateOrderTotals(order);

    // Assert
    expect(order.subtotal_gross).toBe(0);
    expect(order.subtotal_net).toBe(0);
    expect(order.total_discount).toBe(0);
    expect(order.total_vat).toBe(0);
    expect(order.order_total).toBe(0);
  });

  it("should include shipping cost in order_total", () => {
    /**
     * Shipping cost should be added to final total.
     */
    // Arrange
    const order = createMockOrder([
      { line_gross: 1000, line_net: 800, line_vat: 176 },
    ]);
    order.shipping_cost = 15;

    // Act
    recalculateOrderTotals(order);

    // Assert
    expect(order.order_total).toBe(991); // 800 + 176 + 15
  });

  it("should round totals to 2 decimal places", () => {
    /**
     * Ensure currency precision.
     */
    // Arrange
    const order = createMockOrder([
      { line_gross: 33.333, line_net: 26.666, line_vat: 5.866 },
    ]);

    // Act
    recalculateOrderTotals(order);

    // Assert
    expect(order.subtotal_gross).toBe(33.33);
    expect(order.subtotal_net).toBe(26.67);
    expect(order.total_vat).toBe(5.87);
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

  it("should return next multiple of 10", () => {
    /**
     * Line numbers increment by 10: 10, 20, 30...
     */
    // Arrange
    const items = [
      { line_number: 10 },
      { line_number: 20 },
    ] as ILineItem[];

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
    ] as ILineItem[];

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
    const items = [{ line_number: 10 }] as ILineItem[];

    // Act
    const result = getNextLineNumber(items);

    // Assert
    expect(result).toBe(20);
  });

  it("should handle undefined/null items array", () => {
    /**
     * Defensive: handle edge cases.
     */
    // @ts-expect-error Testing null/undefined handling
    expect(getNextLineNumber(null)).toBe(10);
    // @ts-expect-error Testing null/undefined handling
    expect(getNextLineNumber(undefined)).toBe(10);
  });
});
