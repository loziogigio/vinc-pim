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

// ============================================
// calculateLineItemTotals - VAT inclusive
// ============================================

describe("unit: calculateLineItemTotals (vat_included)", () => {
  it("should extract VAT from gross price (22%)", () => {
    // Price 122 gross, vat_rate=22% → net=100, vat=22
    const result = calculateLineItemTotals(1, 122, 122, 22, true);
    expect(result.line_net).toBe(100);
    expect(result.line_vat).toBe(22);
    expect(result.line_total).toBe(122);
    expect(result.line_gross).toBe(100);
  });

  it("should extract VAT from gross price (10%)", () => {
    // Price 110 gross, vat_rate=10% → net=100, vat=10
    const result = calculateLineItemTotals(1, 110, 110, 10, true);
    expect(result.line_net).toBe(100);
    expect(result.line_vat).toBe(10);
    expect(result.line_total).toBe(110);
  });

  it("should extract VAT from gross price (4%)", () => {
    // Price 104 gross, vat_rate=4% → net=100, vat=4
    const result = calculateLineItemTotals(1, 104, 104, 4, true);
    expect(result.line_net).toBe(100);
    expect(result.line_vat).toBe(4);
    expect(result.line_total).toBe(104);
  });

  it("should handle discounted VAT-inclusive price", () => {
    // list=122 (gross), unit=100 (discounted gross), vat=22%
    // line_gross = 122/1.22 = 100, line_net = 100/1.22 ≈ 81.97
    const result = calculateLineItemTotals(1, 122, 100, 22, true);
    expect(result.line_gross).toBe(100);
    expect(result.line_net).toBeCloseTo(81.97, 2);
    expect(result.line_total).toBe(100);
  });

  it("should handle multiple quantities with VAT-inclusive", () => {
    // qty=5, unit_price=12.20 (gross), vat=22%
    // line_total = 5 * 12.20 = 61, line_net = 61/1.22 = 50, line_vat = 11
    const result = calculateLineItemTotals(5, 12.20, 12.20, 22, true);
    expect(result.line_total).toBe(61);
    expect(result.line_net).toBe(50);
    expect(result.line_vat).toBe(11);
  });

  it("should handle zero VAT rate with vat_included", () => {
    // VAT-exempt: price is the same whether gross or net
    const result = calculateLineItemTotals(10, 100, 80, 0, true);
    expect(result.line_gross).toBe(1000);
    expect(result.line_net).toBe(800);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(800);
  });

  it("should default to net calculation when vat_included is false", () => {
    const resultFalse = calculateLineItemTotals(10, 100, 80, 22, false);
    const resultUndefined = calculateLineItemTotals(10, 100, 80, 22);
    expect(resultFalse).toEqual(resultUndefined);
    expect(resultFalse.line_net).toBe(800);
    expect(resultFalse.line_vat).toBe(176);
  });

  it("should round extracted VAT to 2 decimal places", () => {
    // 9.99 gross, 22% → net = 9.99/1.22 = 8.1885... → 8.19, vat = 1.80
    const result = calculateLineItemTotals(1, 9.99, 9.99, 22, true);
    expect(result.line_net).toBe(8.19);
    expect(result.line_vat).toBe(1.80);
    expect(result.line_total).toBe(9.99);
  });
});

// ============================================
// recalculateOrderTotals - VAT inclusive items
// ============================================

describe("unit: recalculateOrderTotals (vat_included items)", () => {
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

  it("should calculate totals for VAT-inclusive items", () => {
    // Item with gross price 122, vat_rate=22%, vat_included=true
    // Calculated: line_net=100, line_vat=22, line_gross=100
    const order = createMockOrder([
      {
        vat_included: true,
        list_price: 122,
        unit_price: 122,
        vat_rate: 22,
        line_gross: 100,
        line_net: 100,
        line_vat: 22,
        line_total: 122,
      },
    ]);

    recalculateOrderTotals(order);

    expect(order.subtotal_gross).toBe(100);
    expect(order.subtotal_net).toBe(100);
    expect(order.total_vat).toBe(22);
    expect(order.order_total).toBe(122);
  });

  it("should handle mixed VAT-inclusive and VAT-exclusive items", () => {
    // Item 1: VAT-inclusive, gross 122 → net=100, vat=22
    // Item 2: VAT-exclusive, net=200, vat=44 (22%)
    const order = createMockOrder([
      {
        vat_included: true,
        line_gross: 100,
        line_net: 100,
        line_vat: 22,
      },
      {
        vat_included: false,
        line_gross: 200,
        line_net: 200,
        line_vat: 44,
      },
    ]);

    recalculateOrderTotals(order);

    expect(order.subtotal_gross).toBe(300);
    expect(order.subtotal_net).toBe(300);
    expect(order.total_vat).toBe(66);
    expect(order.order_total).toBe(366);
  });

  it("should apply line adjustment with correct VAT factor for VAT-inclusive item", () => {
    // VAT-inclusive item: unit_price=122 (gross), vat_rate=22%
    // line_net=100, line_vat=22
    // Price override to 100 (gross) → priceDiff = (122-100)*1 = 22
    // vatFactor for vat_included = 22/(100+22) = 0.18032...
    // VAT reduction = 22 * 0.18032... ≈ 3.97
    const order = createMockOrder([
      {
        vat_included: true,
        unit_price: 122,
        vat_rate: 22,
        line_gross: 100,
        line_net: 100,
        line_vat: 22,
        quantity: 1,
      },
    ]);
    order.line_adjustments = [
      { line_number: 10, type: "price_override", new_value: 100 } as any,
    ];

    recalculateOrderTotals(order);

    // subtotal_net = 100 - 22 = 78
    expect(order.subtotal_net).toBe(78);
    // totalVat = 22 - 22*(22/122) ≈ 22 - 3.97 ≈ 18.03
    expect(order.total_vat).toBeCloseTo(18.03, 2);
  });
});
