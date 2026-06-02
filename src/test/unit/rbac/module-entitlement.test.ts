import { describe, it, expect } from "vitest";
import { resolveEntitledModules, ALWAYS_ENTITLED } from "@/config/module-entitlement";

describe("resolveEntitledModules", () => {
  it("undefined ⇒ all app ids (back-compat)", () => {
    const all = resolveEntitledModules(undefined);
    expect(all).toContain("pim");
    expect(all).toContain("store-orders");
    expect(all.length).toBeGreaterThan(10);
  });

  it("[] ⇒ only the always-entitled shell apps", () => {
    expect(resolveEntitledModules([])).toEqual(ALWAYS_ENTITLED);
  });

  it("explicit list ⇒ configured ids unioned with always-entitled, invalid dropped", () => {
    const result = resolveEntitledModules(["pim", "not-a-real-app"]);
    expect(result).toContain("pim");
    expect(result).toContain("home"); // ALWAYS_ENTITLED
    expect(result).not.toContain("not-a-real-app");
  });
});
