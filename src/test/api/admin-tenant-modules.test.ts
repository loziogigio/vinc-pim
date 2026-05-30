import { describe, it, expect } from "vitest";
import { resolveEntitledModules } from "@/config/module-entitlement";

describe("enabled_modules validation contract", () => {
  it("drops invalid ids and keeps valid ones", () => {
    const cleaned = resolveEntitledModules(["pim", "store-orders", "bogus"]);
    expect(cleaned).toContain("pim");
    expect(cleaned).toContain("store-orders");
    expect(cleaned).not.toContain("bogus");
  });
});
