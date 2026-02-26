/**
 * Unit Tests for Document Totals & Line Item Calculations
 *
 * Tests the calculation helpers used across document creation and editing.
 */

import { describe, it, expect } from "vitest";
import {
  calculateDocumentLineTotals,
  calculateDocumentTotals,
  getNextDocumentLineNumber,
} from "@/lib/types/document";
import type { DocumentLineItem } from "@/lib/types/document";

// ============================================
// LINE ITEM CALCULATIONS
// ============================================

describe("unit: Document Totals - calculateDocumentLineTotals", () => {
  it("should calculate simple line item (no discount)", () => {
    const result = calculateDocumentLineTotals(2, 100, 22);
    expect(result.line_net).toBe(200);
    expect(result.line_vat).toBe(44);
    expect(result.line_total).toBe(244);
  });

  it("should calculate line item with discount", () => {
    const result = calculateDocumentLineTotals(1, 100, 22, 10);
    // 100 * (1 - 0.10) = 90 net
    // 90 * 0.22 = 19.80 vat
    // 90 + 19.80 = 109.80 total
    expect(result.line_net).toBe(90);
    expect(result.line_vat).toBe(19.8);
    expect(result.line_total).toBe(109.8);
  });

  it("should handle zero quantity", () => {
    const result = calculateDocumentLineTotals(0, 100, 22);
    expect(result.line_net).toBe(0);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(0);
  });

  it("should handle zero price", () => {
    const result = calculateDocumentLineTotals(5, 0, 22);
    expect(result.line_net).toBe(0);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(0);
  });

  it("should handle zero VAT rate", () => {
    const result = calculateDocumentLineTotals(3, 50, 0);
    expect(result.line_net).toBe(150);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(150);
  });

  it("should handle 100% discount", () => {
    const result = calculateDocumentLineTotals(5, 100, 22, 100);
    expect(result.line_net).toBe(0);
    expect(result.line_vat).toBe(0);
    expect(result.line_total).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    // 3 * 7.33 = 21.99
    // 21.99 * 0.22 = 4.8378
    const result = calculateDocumentLineTotals(3, 7.33, 22);
    expect(result.line_net).toBe(21.99);
    expect(result.line_vat).toBe(4.84); // rounded
    expect(result.line_total).toBe(26.83);
  });

  it("should handle decimal quantities", () => {
    const result = calculateDocumentLineTotals(1.5, 100, 22);
    expect(result.line_net).toBe(150);
    expect(result.line_vat).toBe(33);
    expect(result.line_total).toBe(183);
  });

  it("should handle undefined discount as no discount", () => {
    const result = calculateDocumentLineTotals(1, 100, 22, undefined);
    expect(result.line_net).toBe(100);
    expect(result.line_vat).toBe(22);
    expect(result.line_total).toBe(122);
  });
});

// ============================================
// DOCUMENT TOTALS
// ============================================

describe("unit: Document Totals - calculateDocumentTotals", () => {
  it("should calculate totals for a single item", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "Product A",
        quantity: 2,
        unit_price: 100,
        vat_rate: 22,
        line_net: 200,
        line_vat: 44,
        line_total: 244,
      },
    ];
    const result = calculateDocumentTotals(items);
    expect(result.subtotal_net).toBe(200);
    expect(result.total_vat).toBe(44);
    expect(result.total).toBe(244);
    expect(result.total_discount).toBe(0);
  });

  it("should calculate totals for multiple items with same VAT rate", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "A",
        quantity: 1,
        unit_price: 100,
        vat_rate: 22,
        line_net: 100,
        line_vat: 22,
        line_total: 122,
      },
      {
        line_number: 20,
        description: "B",
        quantity: 2,
        unit_price: 50,
        vat_rate: 22,
        line_net: 100,
        line_vat: 22,
        line_total: 122,
      },
    ];
    const result = calculateDocumentTotals(items);
    expect(result.subtotal_net).toBe(200);
    expect(result.total_vat).toBe(44);
    expect(result.total).toBe(244);
    expect(result.vat_breakdown.length).toBe(1);
    expect(result.vat_breakdown[0].rate).toBe(22);
    expect(result.vat_breakdown[0].taxable).toBe(200);
    expect(result.vat_breakdown[0].vat).toBe(44);
  });

  it("should produce VAT breakdown by rate", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "Standard VAT",
        quantity: 1,
        unit_price: 100,
        vat_rate: 22,
        line_net: 100,
        line_vat: 22,
        line_total: 122,
      },
      {
        line_number: 20,
        description: "Reduced VAT",
        quantity: 1,
        unit_price: 100,
        vat_rate: 10,
        line_net: 100,
        line_vat: 10,
        line_total: 110,
      },
      {
        line_number: 30,
        description: "Super Reduced VAT",
        quantity: 1,
        unit_price: 100,
        vat_rate: 4,
        line_net: 100,
        line_vat: 4,
        line_total: 104,
      },
    ];

    const result = calculateDocumentTotals(items);
    expect(result.subtotal_net).toBe(300);
    expect(result.total_vat).toBe(36);
    expect(result.total).toBe(336);
    expect(result.vat_breakdown.length).toBe(3);

    // Sorted by rate ascending
    expect(result.vat_breakdown[0].rate).toBe(4);
    expect(result.vat_breakdown[1].rate).toBe(10);
    expect(result.vat_breakdown[2].rate).toBe(22);
  });

  it("should calculate discount totals", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "Discounted",
        quantity: 1,
        unit_price: 100,
        vat_rate: 22,
        discount_percent: 10,
        line_net: 90,
        line_vat: 19.8,
        line_total: 109.8,
      },
    ];
    const result = calculateDocumentTotals(items);
    expect(result.subtotal_net).toBe(90);
    expect(result.total_discount).toBe(10); // 100 - 90
    expect(result.total).toBe(109.8);
  });

  it("should handle empty items array", () => {
    const result = calculateDocumentTotals([]);
    expect(result.subtotal_net).toBe(0);
    expect(result.total_vat).toBe(0);
    expect(result.total).toBe(0);
    expect(result.total_discount).toBe(0);
    expect(result.vat_breakdown.length).toBe(0);
  });

  it("should handle items with zero VAT", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "Exempt",
        quantity: 1,
        unit_price: 200,
        vat_rate: 0,
        line_net: 200,
        line_vat: 0,
        line_total: 200,
      },
    ];
    const result = calculateDocumentTotals(items);
    expect(result.subtotal_net).toBe(200);
    expect(result.total_vat).toBe(0);
    expect(result.total).toBe(200);
    expect(result.vat_breakdown.length).toBe(1);
    expect(result.vat_breakdown[0].rate).toBe(0);
    expect(result.vat_breakdown[0].vat).toBe(0);
  });
});

// ============================================
// LINE NUMBER GENERATION
// ============================================

describe("unit: Document Totals - getNextDocumentLineNumber", () => {
  it("should return 10 for empty array", () => {
    expect(getNextDocumentLineNumber([])).toBe(10);
  });

  it("should return 20 for single item at 10", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
    ];
    expect(getNextDocumentLineNumber(items)).toBe(20);
  });

  it("should return max + 10", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
      {
        line_number: 20,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
      {
        line_number: 30,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
    ];
    expect(getNextDocumentLineNumber(items)).toBe(40);
  });

  it("should handle non-sequential line numbers", () => {
    const items: DocumentLineItem[] = [
      {
        line_number: 10,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
      {
        line_number: 50,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
    ];
    expect(getNextDocumentLineNumber(items)).toBe(60);
  });
});
