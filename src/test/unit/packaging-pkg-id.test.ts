/**
 * Unit Tests for pkg_id Functionality
 *
 * Tests the ensurePackagingIds utility and pkg_id-based matching logic
 * for packaging options (replacing legacy code-based matching).
 */

import { describe, it, expect } from "vitest";
import { ensurePackagingIds } from "@/lib/utils/packaging";
import type { PackagingOption } from "@/lib/types/pim";
import { PackagingOptionFactory } from "../conftest";

// Helper: create a minimal PackagingOption for testing
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

describe("unit: ensurePackagingIds", () => {
  // ==========================================
  // Auto-assignment of pkg_id
  // ==========================================

  it("should assign incremental pkg_id to options without one", () => {
    const options = [makePkg({ code: "PZ" }), makePkg({ code: "BOX", qty: 6 })];

    const result = ensurePackagingIds(options);

    expect(result[0].pkg_id).toBe("1");
    expect(result[1].pkg_id).toBe("2");
  });

  it("should generate unique pkg_ids for each option", () => {
    const options = [
      makePkg({ code: "PZ" }),
      makePkg({ code: "BOX", qty: 6 }),
      makePkg({ code: "CF", qty: 12 }),
    ];

    const result = ensurePackagingIds(options);

    const ids = result.map((r) => r.pkg_id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it("should preserve existing pkg_id values", () => {
    const options = [
      makePkg({ code: "PZ", pkg_id: "existing1" }),
      makePkg({ code: "BOX", pkg_id: "existing2", qty: 6 }),
    ];

    const result = ensurePackagingIds(options);

    expect(result[0].pkg_id).toBe("existing1");
    expect(result[1].pkg_id).toBe("existing2");
  });

  it("should return original array reference when no changes needed", () => {
    const options = [
      makePkg({ code: "PZ", pkg_id: "abc12345" }),
      makePkg({ code: "BOX", pkg_id: "def67890", qty: 6 }),
    ];

    const result = ensurePackagingIds(options);

    expect(result).toBe(options); // Same reference
  });

  it("should return new array when changes were made", () => {
    const options = [makePkg({ code: "PZ" })]; // No pkg_id

    const result = ensurePackagingIds(options);

    expect(result).not.toBe(options); // New reference
  });

  it("should handle mixed: some with pkg_id, some without", () => {
    const options = [
      makePkg({ code: "PZ", pkg_id: "keep-this" }),
      makePkg({ code: "BOX", qty: 6 }), // No pkg_id
      makePkg({ code: "CF", pkg_id: "keep-too", qty: 12 }),
    ];

    const result = ensurePackagingIds(options);

    expect(result[0].pkg_id).toBe("keep-this");
    expect(result[1].pkg_id).toBeDefined();
    expect(result[1].pkg_id).not.toBe("keep-this");
    expect(result[1].pkg_id).not.toBe("keep-too");
    expect(result[2].pkg_id).toBe("keep-too");
  });

  it("should handle empty array", () => {
    const result = ensurePackagingIds([]);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("should normalize numeric pkg_id to string (lean() MongoDB compat)", () => {
    // MongoDB .lean() may return numeric pkg_id if schema was briefly Number type
    const options = [
      makePkg({ code: "PZ", pkg_id: 1 as any }),
      makePkg({ code: "BOX", pkg_id: 2 as any, qty: 6 }),
    ];

    const result = ensurePackagingIds(options);

    expect(result[0].pkg_id).toBe("1");
    expect(result[1].pkg_id).toBe("2");
    expect(typeof result[0].pkg_id).toBe("string");
    expect(typeof result[1].pkg_id).toBe("string");
  });

  it("should assign new ids after normalizing numeric ones", () => {
    const options = [
      makePkg({ code: "PZ", pkg_id: 3 as any }),
      makePkg({ code: "BOX", qty: 6 }), // No pkg_id
    ];

    const result = ensurePackagingIds(options);

    expect(result[0].pkg_id).toBe("3");
    expect(result[1].pkg_id).toBe("4"); // Increments from max=3
  });

  it("should preserve all other fields", () => {
    const original = makePkg({
      code: "BOX",
      qty: 6,
      uom: "PZ",
      is_default: true,
      is_smallest: false,
      is_sellable: true,
      ean: "1234567890123",
      position: 2,
      pricing: { list: 100, retail: 200, list_unit: 16.67, retail_unit: 33.33 },
    });

    const result = ensurePackagingIds([original]);

    expect(result[0].code).toBe("BOX");
    expect(result[0].qty).toBe(6);
    expect(result[0].uom).toBe("PZ");
    expect(result[0].is_default).toBe(true);
    expect(result[0].is_smallest).toBe(false);
    expect(result[0].is_sellable).toBe(true);
    expect(result[0].ean).toBe("1234567890123");
    expect(result[0].position).toBe(2);
    expect(result[0].pricing?.list).toBe(100);
    expect(result[0].pricing?.retail).toBe(200);
  });

  it("should not modify original option objects", () => {
    const original = makePkg({ code: "PZ" });
    const originalCopy = { ...original };

    ensurePackagingIds([original]);

    // Original object should not be mutated
    expect(original.pkg_id).toBeUndefined();
    expect(original.code).toBe(originalCopy.code);
  });

  it("should work with factory-created packaging options", () => {
    const options = [
      PackagingOptionFactory.createDefault(),
      PackagingOptionFactory.createBox(),
      PackagingOptionFactory.createNonSellable(),
    ];

    const result = ensurePackagingIds(options as PackagingOption[]);

    expect(result).toHaveLength(3);
    result.forEach((pkg, i) => {
      expect(pkg.pkg_id).toBe(String(i + 1));
    });
  });
});

// ==========================================
// pkg_id-based Matching Logic
// ==========================================

describe("unit: pkg_id matching logic", () => {
  it("should find packaging option by pkg_id (not code)", () => {
    const options: PackagingOption[] = [
      makePkg({ code: "PZ", pkg_id: "id-001" }),
      makePkg({ code: "PZ", pkg_id: "id-002", qty: 6 }), // Same code, different pkg_id
      makePkg({ code: "BOX", pkg_id: "id-003", qty: 12 }),
    ];

    const target = options.find((p) => p.pkg_id === "id-002");

    expect(target).toBeDefined();
    expect(target!.qty).toBe(6);
  });

  it("should allow duplicate codes with different pkg_ids", () => {
    const options: PackagingOption[] = [
      makePkg({ code: "PZ", pkg_id: "id-a", qty: 1, pricing: { list: 10 } }),
      makePkg({ code: "PZ", pkg_id: "id-b", qty: 1, pricing: { list: 20 } }),
    ];

    // This is the key benefit: duplicate codes are now supported
    const uniquePkgIds = new Set(options.map((o) => o.pkg_id));
    expect(uniquePkgIds.size).toBe(2);

    // Can update the correct one by pkg_id
    const updated = options.map((p) =>
      p.pkg_id === "id-b" ? { ...p, pricing: { list: 25 } } : p
    );

    expect(updated[0].pricing?.list).toBe(10); // Unchanged
    expect(updated[1].pricing?.list).toBe(25); // Updated
  });

  it("should update packaging by pkg_id instead of code", () => {
    const existingOptions: PackagingOption[] = [
      makePkg({ code: "PZ", pkg_id: "aaa", qty: 1, pricing: { list: 10 } }),
      makePkg({ code: "PZ", pkg_id: "bbb", qty: 1, pricing: { list: 20 } }),
      makePkg({ code: "BOX", pkg_id: "ccc", qty: 6, pricing: { list: 60 } }),
    ];

    const editingPkgId = "bbb";
    const updatedOption = makePkg({ code: "PZ", pkg_id: "bbb", qty: 1, pricing: { list: 30 } });

    const result = existingOptions.map((p) =>
      p.pkg_id === editingPkgId ? updatedOption : p
    );

    expect(result[0].pricing?.list).toBe(10); // First PZ unchanged
    expect(result[1].pricing?.list).toBe(30); // Second PZ updated
    expect(result[2].pricing?.list).toBe(60); // BOX unchanged
  });

  it("should delete packaging by pkg_id", () => {
    const existingOptions: PackagingOption[] = [
      makePkg({ code: "PZ", pkg_id: "aaa" }),
      makePkg({ code: "PZ", pkg_id: "bbb" }),
      makePkg({ code: "BOX", pkg_id: "ccc" }),
    ];

    const deleteId = "bbb";
    const result = existingOptions.filter((p) => p.pkg_id !== deleteId);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.pkg_id)).toEqual(["aaa", "ccc"]);
  });

  it("should match promotions to correct packaging by pkg_id", () => {
    const options: PackagingOption[] = [
      makePkg({ code: "PZ", pkg_id: "pkg-1", promotions: [] }),
      makePkg({ code: "PZ", pkg_id: "pkg-2", promotions: [] }),
    ];

    const targetPkgId = "pkg-2";
    const newPromo = {
      promo_code: "SUMMER",
      is_active: true,
      label: { it: "Estate", en: "Summer" },
      discount_percentage: 10,
    };

    const result = options.map((pkg) => {
      if (pkg.pkg_id !== targetPkgId) return pkg;
      return { ...pkg, promotions: [...(pkg.promotions || []), newPromo] };
    });

    expect(result[0].promotions).toHaveLength(0);
    expect(result[1].promotions).toHaveLength(1);
    expect(result[1].promotions![0].promo_code).toBe("SUMMER");
  });
});

// ==========================================
// Duplicate Mode (create from existing)
// ==========================================

describe("unit: packaging duplicate mode", () => {
  it("should clear code and pkg_id when duplicating", () => {
    const source = makePkg({
      code: "PZ",
      pkg_id: "original-id",
      qty: 6,
      pricing: { list: 100 },
    });

    // Simulate duplicate mode: clear code and pkg_id
    const duplicated: PackagingOption = {
      ...source,
      code: "",
      pkg_id: undefined,
    };

    expect(duplicated.code).toBe("");
    expect(duplicated.pkg_id).toBeUndefined();
    // Other fields preserved
    expect(duplicated.qty).toBe(6);
    expect(duplicated.pricing?.list).toBe(100);
  });

  it("should preserve pricing when duplicating", () => {
    const source = makePkg({
      code: "BOX",
      pkg_id: "src-id",
      qty: 6,
      pricing: {
        list: 600,
        retail: 800,
        sale: 500,
        list_unit: 100,
        retail_unit: 133.33,
        sale_unit: 83.33,
      },
    });

    const duplicated: PackagingOption = {
      ...source,
      code: "",
      pkg_id: undefined,
    };

    expect(duplicated.pricing?.list).toBe(600);
    expect(duplicated.pricing?.retail).toBe(800);
    expect(duplicated.pricing?.sale).toBe(500);
    expect(duplicated.pricing?.list_unit).toBe(100);
    expect(duplicated.pricing?.retail_unit).toBe(133.33);
    expect(duplicated.pricing?.sale_unit).toBe(83.33);
  });

  it("should preserve promotions when duplicating", () => {
    const source = makePkg({
      code: "PZ",
      pkg_id: "src-id",
      promotions: [
        { promo_code: "P1", is_active: true, label: { it: "P1" } },
        { promo_code: "P2", is_active: false, label: { it: "P2" } },
      ],
    });

    const duplicated: PackagingOption = {
      ...source,
      code: "",
      pkg_id: undefined,
    };

    expect(duplicated.promotions).toHaveLength(2);
    expect(duplicated.promotions![0].promo_code).toBe("P1");
  });

  it("should preserve tag_filter when duplicating", () => {
    const source = makePkg({
      code: "PZ",
      pkg_id: "src-id",
      pricing: {
        list: 100,
        tag_filter: ["TIPO:gold", "TIPO:silver"],
      },
    });

    const duplicated: PackagingOption = {
      ...source,
      code: "",
      pkg_id: undefined,
    };

    expect(duplicated.pricing?.tag_filter).toEqual(["TIPO:gold", "TIPO:silver"]);
  });
});
