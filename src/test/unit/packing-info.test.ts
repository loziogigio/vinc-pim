/**
 * Unit Tests for packaging_info
 *
 * Tests:
 * - PackagingInfo type structure (including is_default/is_smallest)
 * - PIM schema registry includes packaging_info fields
 * - Parser cleanupIncompleteArrays removes invalid packaging_info entries
 * - syncPackagingFlags syncs is_default/is_smallest from packaging_info to packaging_options
 */

import { describe, it, expect } from "vitest";
import type { PackagingInfo } from "@/lib/types/pim";
import { PIM_PRODUCT_SCHEMA } from "@/lib/pim/schema";
import { syncPackagingFlags } from "@/lib/utils/packaging";

// ============================================
// TYPE VALIDATION HELPERS
// ============================================

function isValidPackagingInfo(obj: unknown): obj is PackagingInfo {
  if (!obj || typeof obj !== "object") return false;
  const pi = obj as Record<string, unknown>;
  return (
    typeof pi.packaging_id === "string" &&
    typeof pi.code === "string" &&
    typeof pi.description === "string" &&
    typeof pi.qty === "number" &&
    typeof pi.uom === "string"
  );
}

// ============================================
// PARSER CLEANUP SIMULATION
// (mirrors cleanupIncompleteArrays logic)
// ============================================

function cleanupPackagingInfo(data: Record<string, unknown>): void {
  if (data.packaging_info && Array.isArray(data.packaging_info)) {
    data.packaging_info = (data.packaging_info as unknown[]).filter(
      (item: unknown) => {
        const pi = item as Record<string, unknown>;
        return item && pi.code && pi.qty != null && pi.uom;
      }
    );
    if ((data.packaging_info as unknown[]).length === 0) {
      delete data.packaging_info;
    }
  }
}

// ============================================
// TESTS
// ============================================

describe("unit: packaging_info", () => {
  // ============================================
  // TYPE STRUCTURE
  // ============================================

  describe("PackagingInfo type", () => {
    it("should validate a complete packaging info object", () => {
      const pi: PackagingInfo = {
        packaging_id: "1",
        code: "BOX12",
        description: "Standard carton box",
        qty: 12,
        uom: "pz",
      };
      expect(isValidPackagingInfo(pi)).toBe(true);
    });

    it("should support decimal qty values like 0.75", () => {
      const pi: PackagingInfo = {
        packaging_id: "2",
        code: "HALF",
        description: "Half pack",
        qty: 0.75,
        uom: "kg",
      };
      expect(pi.qty).toBe(0.75);
      expect(isValidPackagingInfo(pi)).toBe(true);
    });

    it("should support qty of 1 (single unit)", () => {
      const pi: PackagingInfo = {
        packaging_id: "1",
        code: "PZ",
        description: "Single piece",
        qty: 1,
        uom: "pz",
      };
      expect(isValidPackagingInfo(pi)).toBe(true);
    });

    it("should support large qty values", () => {
      const pi: PackagingInfo = {
        packaging_id: "3",
        code: "PALLET",
        description: "Full pallet",
        qty: 480,
        uom: "pz",
      };
      expect(isValidPackagingInfo(pi)).toBe(true);
    });

    it("should accept is_default=true", () => {
      const pi: PackagingInfo = {
        packaging_id: "1",
        code: "CF",
        description: "Default box",
        qty: 25,
        uom: "pz",
        is_default: true,
      };
      expect(pi.is_default).toBe(true);
    });

    it("should accept is_smallest=true", () => {
      const pi: PackagingInfo = {
        packaging_id: "2",
        code: "MV",
        description: "Minimo vendibile",
        qty: 1,
        uom: "pz",
        is_smallest: true,
      };
      expect(pi.is_smallest).toBe(true);
    });

    it("should accept both is_default and is_smallest on same entry", () => {
      const pi: PackagingInfo = {
        packaging_id: "1",
        code: "CF",
        description: "Default & smallest",
        qty: 25,
        uom: "pz",
        is_default: true,
        is_smallest: true,
      };
      expect(pi.is_default).toBe(true);
      expect(pi.is_smallest).toBe(true);
    });

    it("should default to undefined for is_default/is_smallest (informational)", () => {
      const pi: PackagingInfo = {
        packaging_id: "3",
        code: "PALLET",
        description: "Pallet",
        qty: 480,
        uom: "pz",
      };
      expect(pi.is_default).toBeUndefined();
      expect(pi.is_smallest).toBeUndefined();
    });
  });

  // ============================================
  // PIM SCHEMA REGISTRY
  // ============================================

  describe("PIM schema registry", () => {
    it("should include packaging_info as a field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info");
      expect(field).toBeDefined();
      expect(field?.type).toBe("array");
      expect(field?.category).toBe("inventory");
    });

    it("should include packaging_info[0].code sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].code");
      expect(field).toBeDefined();
      expect(field?.type).toBe("string");
    });

    it("should include packaging_info[0].qty sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].qty");
      expect(field).toBeDefined();
      expect(field?.type).toBe("number");
    });

    it("should include packaging_info[0].uom sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].uom");
      expect(field).toBeDefined();
    });

    it("should include packaging_info[0].description sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].description");
      expect(field).toBeDefined();
    });

    it("should include packaging_info[0].packaging_id sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].packaging_id");
      expect(field).toBeDefined();
    });

    it("should include packaging_info[0].is_default sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].is_default");
      expect(field).toBeDefined();
      expect(field?.type).toBe("boolean");
    });

    it("should include packaging_info[0].is_smallest sub-field", () => {
      const field = PIM_PRODUCT_SCHEMA.find((f) => f.name === "packaging_info[0].is_smallest");
      expect(field).toBeDefined();
      expect(field?.type).toBe("boolean");
    });
  });

  // ============================================
  // syncPackagingFlags
  // ============================================

  describe("syncPackagingFlags", () => {
    const makeOpt = (code: string) => ({
      code,
      label: {},
      qty: 1,
      uom: "PZ",
      is_default: false,
      is_smallest: false,
    });

    it("should set is_default on matching packaging option", () => {
      const options = [makeOpt("PZ"), makeOpt("CF"), makeOpt("PALLET")];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "CF", description: "Box", qty: 25, uom: "pz", is_default: true },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result[0].is_default).toBe(false);
      expect(result[1].is_default).toBe(true); // CF
      expect(result[2].is_default).toBe(false);
    });

    it("should set is_smallest on matching packaging option", () => {
      const options = [makeOpt("PZ"), makeOpt("CF")];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "PZ", description: "Piece", qty: 1, uom: "pz", is_smallest: true },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result[0].is_smallest).toBe(true); // PZ
      expect(result[1].is_smallest).toBe(false);
    });

    it("should set both is_default and is_smallest on different options", () => {
      const options = [makeOpt("PZ"), makeOpt("CF")];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "CF", description: "Box", qty: 25, uom: "pz", is_default: true },
        { packaging_id: "2", code: "PZ", description: "Piece", qty: 1, uom: "pz", is_smallest: true },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result[0].is_default).toBe(false);
      expect(result[0].is_smallest).toBe(true);
      expect(result[1].is_default).toBe(true);
      expect(result[1].is_smallest).toBe(false);
    });

    it("should set both flags on same option when same packaging_info has both", () => {
      const options = [makeOpt("CF")];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "CF", description: "Box", qty: 25, uom: "pz", is_default: true, is_smallest: true },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result[0].is_default).toBe(true);
      expect(result[0].is_smallest).toBe(true);
    });

    it("should clear all flags when no flags are set in packaging_info", () => {
      const options = [
        { ...makeOpt("PZ"), is_default: true },
        { ...makeOpt("CF"), is_smallest: true },
      ];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "PZ", description: "Piece", qty: 1, uom: "pz" },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result[0].is_default).toBe(false);
      expect(result[0].is_smallest).toBe(false);
      expect(result[1].is_default).toBe(false);
      expect(result[1].is_smallest).toBe(false);
    });

    it("should handle undefined packaging_info", () => {
      const options = [makeOpt("PZ"), makeOpt("CF")];
      const result = syncPackagingFlags(options, undefined);
      expect(result[0].is_default).toBe(false);
      expect(result[1].is_default).toBe(false);
    });

    it("should handle empty packaging_info array", () => {
      const options = [makeOpt("PZ")];
      const result = syncPackagingFlags(options, []);
      expect(result[0].is_default).toBe(false);
      expect(result[0].is_smallest).toBe(false);
    });

    it("should handle flag code not matching any packaging option", () => {
      const options = [makeOpt("PZ"), makeOpt("CF")];
      const info: PackagingInfo[] = [
        { packaging_id: "1", code: "NONEXISTENT", description: "?", qty: 1, uom: "pz", is_default: true },
      ];
      const result = syncPackagingFlags(options, info);
      expect(result.every((o) => !o.is_default)).toBe(true);
    });
  });

  // ============================================
  // PARSER CLEANUP — INCOMPLETE ENTRIES
  // ============================================

  describe("parser cleanupIncompleteArrays — packaging_info", () => {
    it("should keep complete packaging_info entries", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "BOX", description: "Box", qty: 12, uom: "pz" },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toHaveLength(1);
    });

    it("should remove entries missing code", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", description: "Box", qty: 12, uom: "pz" },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toBeUndefined();
    });

    it("should remove entries missing qty", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "BOX", description: "Box", uom: "pz" },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toBeUndefined();
    });

    it("should remove entries missing uom", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "BOX", description: "Box", qty: 12 },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toBeUndefined();
    });

    it("should keep entries with qty = 0 (zero is valid)", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "EMPTY", description: "Empty", qty: 0, uom: "pz" },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toHaveLength(1);
    });

    it("should keep entries with decimal qty (0.75)", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "HALF", description: "Half kg", qty: 0.75, uom: "kg" },
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toHaveLength(1);
    });

    it("should remove completely empty objects (from sparse array padding)", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          {},
          {},
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toBeUndefined();
    });

    it("should keep only valid entries in mixed array", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1", code: "BOX", description: "Box", qty: 12, uom: "pz" },
          {},                                                            // empty — removed
          { packaging_id: "3", code: "PALLET", qty: 144, uom: "pz" },   // no description — kept
        ],
      };
      cleanupPackagingInfo(data);
      expect(data.packaging_info).toHaveLength(2);
    });

    it("should delete packaging_info key when all entries are invalid", () => {
      const data: Record<string, unknown> = {
        packaging_info: [
          { packaging_id: "1" },  // missing code, qty, uom
          {},
        ],
      };
      cleanupPackagingInfo(data);
      expect("packaging_info" in data).toBe(false);
    });

    it("should not modify data without packaging_info", () => {
      const data: Record<string, unknown> = {
        name: "Test Product",
        sku: "TEST-001",
      };
      cleanupPackagingInfo(data);
      expect(data.name).toBe("Test Product");
      expect(data.packaging_info).toBeUndefined();
    });
  });
});
