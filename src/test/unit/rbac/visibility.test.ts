import { describe, it, expect } from "vitest";
import { getVisibleApps, appVisibility } from "@/lib/auth/permissions/visibility";

const APPS = [
  { id: "pim" },           // cataloged (has permissions)
  { id: "store-orders" },  // cataloged
  { id: "settings" },      // NOT cataloged (no permissions defined yet)
];

describe("appVisibility", () => {
  it("not entitled ⇒ cta", () => {
    expect(appVisibility("pim", [], new Set())).toBe("cta");
  });

  it("entitled + cataloged + has a permission ⇒ usable", () => {
    expect(appVisibility("pim", ["pim"], new Set(["pim.product.view"]))).toBe("usable");
  });

  it("entitled + cataloged + no permission ⇒ hidden", () => {
    expect(appVisibility("store-orders", ["store-orders"], new Set())).toBe("hidden");
  });

  it("entitled + NOT cataloged ⇒ usable (entitlement-only, non-breaking)", () => {
    expect(appVisibility("settings", ["settings"], new Set())).toBe("usable");
  });
});

describe("getVisibleApps", () => {
  it("tags every app", () => {
    const tagged = getVisibleApps(APPS, ["pim", "settings"], new Set(["pim.product.view"]));
    expect(tagged).toEqual([
      { app: { id: "pim" }, state: "usable" },
      { app: { id: "store-orders" }, state: "cta" }, // not entitled
      { app: { id: "settings" }, state: "usable" },   // entitled, uncataloged
    ]);
  });
});
