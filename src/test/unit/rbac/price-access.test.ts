import { describe, it, expect } from "vitest";
import { PRICE_ACCESS_LEVELS, isPriceAccess, PRESET_PRICE_ACCESS, type PriceAccess } from "@/lib/auth/permissions/price-access";

describe("price-access", () => {
  it("defines exactly none/view/edit in order", () => {
    expect(PRICE_ACCESS_LEVELS).toEqual(["none", "view", "edit"]);
  });
  it("isPriceAccess accepts valid levels, rejects others", () => {
    expect(isPriceAccess("view")).toBe(true);
    expect(isPriceAccess("edit")).toBe(true);
    expect(isPriceAccess("none")).toBe(true);
    expect(isPriceAccess("admin")).toBe(false);
    expect(isPriceAccess("")).toBe(false);
  });
  it("maps each system-role preset key to a price level", () => {
    expect(PRESET_PRICE_ACCESS.admin).toBe("edit");
    expect(PRESET_PRICE_ACCESS.helpdesk).toBe("view");
    expect(PRESET_PRICE_ACCESS.agent).toBe("view");
    expect(PRESET_PRICE_ACCESS.viewer).toBe("view");
  });
  it("PriceAccess type is assignable from a level", () => {
    const x: PriceAccess = "edit";
    expect(x).toBe("edit");
  });
});
