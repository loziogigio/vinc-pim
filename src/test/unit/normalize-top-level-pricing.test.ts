/**
 * Unit tests for normalizeTopLevelPricing
 *
 * Verifies that top-level pricing.list is rewritten to per-unit when the
 * source ERP has stored the per-MV (per-packaging) total at the top level
 * — the metro/KG/LT double-multiplication bug.
 */

import { describe, it, expect } from "vitest";
import { normalizeTopLevelPricing } from "@/lib/search/response-enricher";

function pkg(overrides: Record<string, any> = {}) {
  return {
    code: "MV",
    qty: 1,
    uom: "PZ",
    is_sellable: true,
    is_smallest: true,
    pricing: { list: 10, list_unit: 10 },
    ...overrides,
  };
}

describe("unit: normalizeTopLevelPricing", () => {
  it("returns the original pricing when no packaging exists", () => {
    const top = { list: 100, currency: "EUR" };
    const result = normalizeTopLevelPricing(top, undefined, undefined);
    expect(result).toEqual(top);
  });

  it("returns the original pricing when top.list is null", () => {
    const top = { currency: "EUR" };
    const result = normalizeTopLevelPricing(top, [pkg()], undefined);
    expect(result).toEqual(top);
  });

  it("does nothing for piece products (qty=1)", () => {
    const top = { list: 10, retail: 12, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [pkg({ qty: 1, pricing: { list: 10, list_unit: 10 } })],
      [{ code: "MV", is_smallest: true }],
    );
    expect(result).toEqual(top);
  });

  it("fixes the metro bug: top.list = per-MV total → rewrites to per-unit", () => {
    const top = { list: 100, retail: 120, currency: "EUR", vat_rate: 22 };
    const metroPkg = pkg({
      code: "BOB",
      qty: 10,
      uom: "MT",
      pricing: { list: 100, list_unit: 10, retail: 120, retail_unit: 12 },
    });
    const result = normalizeTopLevelPricing(
      top,
      [metroPkg],
      [{ code: "BOB", is_smallest: true }],
    );
    expect(result.list).toBe(10);
    expect(result.retail).toBe(12);
    expect(result.currency).toBe("EUR"); // preserved
    expect(result.vat_rate).toBe(22); // preserved
  });

  it("leaves top.list alone when it already disagrees with per-MV total", () => {
    // top.list looks per-unit already (10), packaging.list is per-MV (100). No bug.
    const top = { list: 10, retail: 12, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "BOB",
          qty: 10,
          uom: "MT",
          pricing: { list: 100, list_unit: 10, retail: 120, retail_unit: 12 },
        }),
      ],
      [{ code: "BOB", is_smallest: true }],
    );
    expect(result).toEqual(top);
  });

  it("picks the smallest sellable packaging via packaging_info code", () => {
    // Two sellable packagings; smallest is BOB (qty=10).
    const top = { list: 1000, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "PALLET",
          qty: 100,
          uom: "MT",
          is_smallest: false,
          pricing: { list: 1000, list_unit: 10 },
        }),
        pkg({
          code: "BOB",
          qty: 10,
          uom: "MT",
          is_smallest: true,
          pricing: { list: 100, list_unit: 10 },
        }),
      ],
      [
        { code: "BOB", is_smallest: true },
        { code: "PALLET", is_smallest: false },
      ],
    );
    // top.list (1000) matches PALLET, not BOB — so detection does NOT fire
    // against the smallest, and the value is preserved.
    expect(result.list).toBe(1000);
  });

  it("ignores non-sellable packagings when picking the smallest", () => {
    const top = { list: 50, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "DOC",
          qty: 5,
          uom: "MT",
          is_sellable: false,
          is_smallest: true,
          pricing: { list: 50, list_unit: 10 },
        }),
        pkg({
          code: "BOB",
          qty: 10,
          uom: "MT",
          is_sellable: true,
          is_smallest: false,
          pricing: { list: 100, list_unit: 10 },
        }),
      ],
      undefined,
    );
    // DOC is not sellable; BOB is picked. top.list (50) != BOB.list (100), so no override.
    expect(result.list).toBe(50);
  });

  it("falls back to is_smallest flag on the option when packaging_info is missing", () => {
    const top = { list: 100, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "BOB",
          qty: 10,
          uom: "MT",
          is_smallest: true,
          pricing: { list: 100, list_unit: 10 },
        }),
      ],
      undefined,
    );
    expect(result.list).toBe(10);
  });

  it("returns original pricing when smallest packaging has no list_unit", () => {
    const top = { list: 100, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "BOB",
          qty: 10,
          pricing: { list: 100 }, // no list_unit
        }),
      ],
      [{ code: "BOB", is_smallest: true }],
    );
    expect(result.list).toBe(100); // unchanged
  });

  it("tolerates fractional differences within 1 cent (rounding tolerance)", () => {
    // packaging.list = 99.995 (close to 100), top.list = 100, difference < 0.01
    const top = { list: 100, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "BOB",
          qty: 10,
          pricing: { list: 99.995, list_unit: 10 },
        }),
      ],
      [{ code: "BOB", is_smallest: true }],
    );
    expect(result.list).toBe(10);
  });

  it("preserves retail when smallest has no retail_unit", () => {
    const top = { list: 100, retail: 120, currency: "EUR" };
    const result = normalizeTopLevelPricing(
      top,
      [
        pkg({
          code: "BOB",
          qty: 10,
          pricing: { list: 100, list_unit: 10 }, // no retail_unit
        }),
      ],
      [{ code: "BOB", is_smallest: true }],
    );
    expect(result.list).toBe(10);
    expect(result.retail).toBe(120); // unchanged
  });
});
