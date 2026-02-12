/**
 * Unit Tests for embedPromotionsInPackaging
 *
 * Tests the computation of per-packaging promotions from product-level promotions.
 * Each packaging option receives promotions that target it based on target_pkg_ids.
 */

import { describe, it, expect } from "vitest";
import { embedPromotionsInPackaging } from "@/lib/search/response-enricher";
import type { PackagingData } from "@/lib/types/search";

function makePkg(overrides: Partial<PackagingData> & { pkg_id?: string } = {}): PackagingData & { pkg_id?: string } {
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

function makePromo(overrides: Record<string, any> = {}) {
  return {
    promo_code: "P1",
    is_active: true,
    label: { it: "Promo 1" },
    promo_price: 50,
    ...overrides,
  };
}

describe("unit: embedPromotionsInPackaging", () => {
  // ===========================================
  // Null/undefined handling
  // ===========================================

  it("should return undefined when packaging is undefined", () => {
    const result = embedPromotionsInPackaging(undefined, [makePromo()]);
    expect(result).toBeUndefined();
  });

  it("should return original packaging when promotions is undefined", () => {
    const pkgs = [makePkg({ pkg_id: "1" })];
    const result = embedPromotionsInPackaging(pkgs, undefined);
    expect(result).toBe(pkgs);
  });

  it("should return original packaging when promotions is empty", () => {
    const pkgs = [makePkg({ pkg_id: "1" })];
    const result = embedPromotionsInPackaging(pkgs, []);
    expect(result).toBe(pkgs);
  });

  it("should return original packaging when packaging is empty", () => {
    const result = embedPromotionsInPackaging([], [makePromo()]);
    expect(result).toEqual([]);
  });

  // ===========================================
  // Default behavior: no target_pkg_ids
  // ===========================================

  it("should assign promotion to all sellable packaging when no target_pkg_ids", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ" }),
      makePkg({ pkg_id: "2", code: "BOX", qty: 6 }),
    ];
    const promos = [makePromo({ promo_code: "SUMMER" })];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(1);
    expect(result[0].promotions![0].promo_code).toBe("SUMMER");
    expect(result[1].promotions).toHaveLength(1);
    expect(result[1].promotions![0].promo_code).toBe("SUMMER");
  });

  it("should NOT assign promotion to non-sellable packaging when no target_pkg_ids", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ", is_sellable: true }),
      makePkg({ pkg_id: "2", code: "DISPLAY", qty: 24, is_sellable: false }),
    ];
    const promos = [makePromo({ promo_code: "SALE" })];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(1);
    expect(result[1].promotions).toHaveLength(0); // Non-sellable excluded
  });

  it("should treat undefined is_sellable as sellable (default true)", () => {
    const pkgs = [makePkg({ pkg_id: "1", code: "PZ" })]; // No is_sellable field
    const promos = [makePromo()];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(1);
  });

  // ===========================================
  // Targeted promotions: target_pkg_ids
  // ===========================================

  it("should assign promotion only to targeted pkg_ids", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ" }),
      makePkg({ pkg_id: "2", code: "BOX", qty: 6 }),
      makePkg({ pkg_id: "3", code: "CF", qty: 12 }),
    ];
    const promos = [makePromo({ promo_code: "BOX-ONLY", target_pkg_ids: ["2"] })];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(0); // Not targeted
    expect(result[1].promotions).toHaveLength(1); // Targeted
    expect(result[1].promotions![0].promo_code).toBe("BOX-ONLY");
    expect(result[2].promotions).toHaveLength(0); // Not targeted
  });

  it("should assign promotion to multiple targeted pkg_ids", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ" }),
      makePkg({ pkg_id: "2", code: "BOX", qty: 6 }),
      makePkg({ pkg_id: "3", code: "CF", qty: 12 }),
    ];
    const promos = [makePromo({ promo_code: "MULTI", target_pkg_ids: ["1", "3"] })];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(1); // Targeted
    expect(result[1].promotions).toHaveLength(0); // Not targeted
    expect(result[2].promotions).toHaveLength(1); // Targeted
  });

  it("should ignore is_sellable when target_pkg_ids is specified", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "DISPLAY", is_sellable: false }),
    ];
    const promos = [makePromo({ target_pkg_ids: ["1"] })];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    // Even though is_sellable=false, the promotion targets this pkg specifically
    expect(result[0].promotions).toHaveLength(1);
  });

  // ===========================================
  // Multiple promotions
  // ===========================================

  it("should handle multiple promotions with different targeting", () => {
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ" }),
      makePkg({ pkg_id: "2", code: "BOX", qty: 6 }),
    ];
    const promos = [
      makePromo({ promo_code: "ALL", target_pkg_ids: [] }), // All sellable
      makePromo({ promo_code: "BOX-ONLY", target_pkg_ids: ["2"] }), // Only BOX
    ];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(1); // Only "ALL"
    expect(result[0].promotions![0].promo_code).toBe("ALL");
    expect(result[1].promotions).toHaveLength(2); // "ALL" + "BOX-ONLY"
    expect(result[1].promotions!.map((p: any) => p.promo_code).sort()).toEqual([
      "ALL",
      "BOX-ONLY",
    ]);
  });

  it("should assign no promotions to packaging that matches nothing", () => {
    const pkgs = [makePkg({ pkg_id: "1", code: "PZ" })];
    const promos = [
      makePromo({ promo_code: "OTHER", target_pkg_ids: ["99"] }),
    ];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(0);
  });

  // ===========================================
  // Duplicate code packaging (key use case)
  // ===========================================

  it("should correctly target by pkg_id when packaging codes are duplicated", () => {
    // Two PZ options with different pkg_ids (the key scenario this feature solves)
    const pkgs = [
      makePkg({ pkg_id: "1", code: "PZ", pricing: { list: 100 } }),
      makePkg({ pkg_id: "2", code: "PZ", pricing: { list: 80 } }),
    ];
    const promos = [
      makePromo({ promo_code: "CHEAP-PZ", target_pkg_ids: ["2"] }),
    ];

    const result = embedPromotionsInPackaging(pkgs, promos)!;

    expect(result[0].promotions).toHaveLength(0); // First PZ: no promo
    expect(result[1].promotions).toHaveLength(1); // Second PZ: targeted
    expect(result[1].promotions![0].promo_code).toBe("CHEAP-PZ");
  });

  // ===========================================
  // Empty target_pkg_ids vs undefined
  // ===========================================

  it("should treat empty target_pkg_ids same as undefined (applies to all sellable)", () => {
    const pkgs = [makePkg({ pkg_id: "1", code: "PZ" })];

    const resultEmpty = embedPromotionsInPackaging(pkgs, [
      makePromo({ target_pkg_ids: [] }),
    ])!;

    const resultUndef = embedPromotionsInPackaging(pkgs, [
      makePromo({ target_pkg_ids: undefined }),
    ])!;

    expect(resultEmpty[0].promotions).toHaveLength(1);
    expect(resultUndef[0].promotions).toHaveLength(1);
  });

  it("should preserve all promotion fields in embedded promotions", () => {
    const pkgs = [makePkg({ pkg_id: "1", code: "PZ" })];
    const promos = [
      makePromo({
        promo_code: "SUMMER",
        is_active: true,
        label: { it: "Estate" },
        promo_price: 50,
        discount_percentage: 20,
        start_date: "2025-06-01",
        end_date: "2025-08-31",
        min_quantity: 3,
        tag_filter: ["tipo:gold"],
      }),
    ];

    const result = embedPromotionsInPackaging(pkgs, promos)!;
    const embedded = result[0].promotions![0];

    expect(embedded.promo_code).toBe("SUMMER");
    expect(embedded.is_active).toBe(true);
    expect(embedded.promo_price).toBe(50);
    expect(embedded.discount_percentage).toBe(20);
    expect(embedded.min_quantity).toBe(3);
    expect(embedded.tag_filter).toEqual(["tipo:gold"]);
  });
});
