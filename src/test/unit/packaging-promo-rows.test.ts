/**
 * Unit Tests for ensurePromoRows
 *
 * Tests the auto-assignment of unique promo_row values to promotions
 * across all packaging options. Mirrors the ensurePackagingIds test pattern.
 */

import { describe, it, expect } from "vitest";
import { ensurePromoRows } from "@/lib/utils/packaging";
import type { PackagingOption } from "@/lib/types/pim";

function makePkg(overrides: Partial<PackagingOption> = {}): PackagingOption {
  return {
    code: "PZ",
    label: { it: "Pezzo", en: "Piece" },
    qty: 1,
    uom: "PZ",
    is_default: false,
    is_smallest: false,
    ...overrides,
  };
}

describe("unit: ensurePromoRows", () => {
  it("should assign incremental promo_row to promotions without one", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "Promo 1" } },
          { promo_code: "P2", is_active: true, label: { it: "Promo 2" } },
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    expect(result[0].promotions![0].promo_row).toBe(1);
    expect(result[0].promotions![1].promo_row).toBe(2);
  });

  it("should preserve existing promo_row values", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "Promo 1" }, promo_row: 10 },
          { promo_code: "P2", is_active: true, label: { it: "Promo 2" }, promo_row: 20 },
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    expect(result[0].promotions![0].promo_row).toBe(10);
    expect(result[0].promotions![1].promo_row).toBe(20);
  });

  it("should return original array reference when no changes needed", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "Promo 1" }, promo_row: 1 },
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    expect(result).toBe(options); // Same reference
  });

  it("should return new array when changes were made", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "Promo 1" } }, // No promo_row
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    expect(result).not.toBe(options); // New reference
  });

  it("should handle mixed: some with promo_row, some without", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "P1" }, promo_row: 5 },
          { promo_code: "P2", is_active: true, label: { it: "P2" } }, // No promo_row
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    expect(result[0].promotions![0].promo_row).toBe(5); // Preserved
    expect(result[0].promotions![1].promo_row).toBe(6); // Assigned: max(5) + 1
  });

  it("should assign unique promo_row across multiple packaging options", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "P1", is_active: true, label: { it: "P1" }, promo_row: 3 },
        ],
      }),
      makePkg({
        code: "BOX",
        pkg_id: "2",
        qty: 6,
        promotions: [
          { promo_code: "P2", is_active: true, label: { it: "P2" } }, // No promo_row
          { promo_code: "P3", is_active: true, label: { it: "P3" } }, // No promo_row
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    // First packaging preserved
    expect(result[0].promotions![0].promo_row).toBe(3);
    // Second packaging increments from max=3
    expect(result[1].promotions![0].promo_row).toBe(4);
    expect(result[1].promotions![1].promo_row).toBe(5);
  });

  it("should handle empty array", () => {
    const result = ensurePromoRows([]);
    expect(result).toEqual([]);
  });

  it("should handle packaging with no promotions", () => {
    const options = [
      makePkg({ code: "PZ", pkg_id: "1" }),
      makePkg({ code: "BOX", pkg_id: "2", qty: 6, promotions: [] }),
    ];

    const result = ensurePromoRows(options);

    expect(result).toBe(options); // Same reference (no changes)
  });

  it("should handle packaging with empty promotions array", () => {
    const options = [makePkg({ code: "PZ", pkg_id: "1", promotions: [] })];

    const result = ensurePromoRows(options);

    expect(result).toBe(options); // Same reference
  });

  it("should not modify original promotion objects", () => {
    const promo = { promo_code: "P1", is_active: true, label: { it: "P1" } };
    const options = [makePkg({ code: "PZ", pkg_id: "1", promotions: [promo] })];

    ensurePromoRows(options);

    // Original promo should not be mutated
    expect(promo.promo_row).toBeUndefined();
  });

  it("should handle all promotions across options needing assignment", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          { promo_code: "A", is_active: true, label: { it: "A" } },
        ],
      }),
      makePkg({
        code: "BOX",
        pkg_id: "2",
        qty: 6,
        promotions: [
          { promo_code: "B", is_active: true, label: { it: "B" } },
          { promo_code: "C", is_active: true, label: { it: "C" } },
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    // All get sequential rows starting from 1
    expect(result[0].promotions![0].promo_row).toBe(1);
    expect(result[1].promotions![0].promo_row).toBe(2);
    expect(result[1].promotions![1].promo_row).toBe(3);

    // All rows are unique
    const allRows = result.flatMap((pkg) =>
      (pkg.promotions || []).map((p) => p.promo_row)
    );
    expect(new Set(allRows).size).toBe(allRows.length);
  });

  it("should preserve other promotion fields when assigning promo_row", () => {
    const options = [
      makePkg({
        code: "PZ",
        pkg_id: "1",
        promotions: [
          {
            promo_code: "SUMMER",
            is_active: true,
            label: { it: "Estate", en: "Summer" },
            discount_percentage: 15,
            promo_price: 85,
            start_date: new Date("2025-06-01"),
            end_date: new Date("2025-08-31"),
            min_quantity: 5,
          },
        ],
      }),
    ];

    const result = ensurePromoRows(options);

    const promo = result[0].promotions![0];
    expect(promo.promo_row).toBe(1);
    expect(promo.promo_code).toBe("SUMMER");
    expect(promo.is_active).toBe(true);
    expect(promo.discount_percentage).toBe(15);
    expect(promo.promo_price).toBe(85);
    expect(promo.min_quantity).toBe(5);
  });
});
