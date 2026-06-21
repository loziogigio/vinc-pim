/**
 * Unit Tests for Module Search
 *
 * Tests the pure `matchApps` matcher that backs the header command palette.
 * Uses the real `getLauncherApps()` registry data and a simple `nameOf` stub.
 */

import { describe, it, expect } from "vitest";
import { matchApps } from "@/lib/utils/module-search";
import { getLauncherApps, type AppConfig } from "@/config/apps.config";

// Simple injected name resolver mirroring what the component does with t().
const nameOf = (app: AppConfig) => app.name;

describe("unit: Module Search - matchApps", () => {
  it("should return [] for an empty query", () => {
    expect(matchApps("", nameOf)).toEqual([]);
  });

  it("should return [] for a whitespace-only query", () => {
    expect(matchApps("   ", nameOf)).toEqual([]);
    expect(matchApps("\t\n", nameOf)).toEqual([]);
  });

  it("should match on name (case-insensitive)", () => {
    const lower = matchApps("pim", nameOf).map((a) => a.id);
    const upper = matchApps("PIM", nameOf).map((a) => a.id);
    const mixed = matchApps("PiM", nameOf).map((a) => a.id);

    expect(lower).toContain("pim");
    expect(upper).toEqual(lower);
    expect(mixed).toEqual(lower);
  });

  it("should trim surrounding whitespace before matching", () => {
    const padded = matchApps("  pim  ", nameOf).map((a) => a.id);
    expect(padded).toContain("pim");
    expect(padded).toEqual(matchApps("pim", nameOf).map((a) => a.id));
  });

  it("should match on description, not just name", () => {
    // "Sessioni e sicurezza" is the Admin app's description (its name is "Admin").
    const ids = matchApps("sicurezza", nameOf).map((a) => a.id);
    expect(ids).toContain("admin");
  });

  it("should match on id, not just name", () => {
    // The "store-portal-users" app's name is "Portal Users"; match via id token.
    const ids = matchApps("store-portal-users", nameOf).map((a) => a.id);
    expect(ids).toContain("store-portal-users");
  });

  it("should return [] when nothing matches", () => {
    expect(matchApps("zzz-no-such-module-zzz", nameOf)).toEqual([]);
  });

  it("should only return launcher apps", () => {
    const launcherIds = new Set(getLauncherApps().map((a) => a.id));
    // "builder" is a registered app but hidden from the launcher.
    const ids = matchApps("builder", nameOf).map((a) => a.id);
    expect(ids).not.toContain("builder");
    ids.forEach((id) => expect(launcherIds.has(id)).toBe(true));
  });

  it("should preserve the registry order of getLauncherApps()", () => {
    const needle = "store";
    const launcher = getLauncherApps();

    // The expected order is the registry order, filtered by the same predicate.
    const expectedOrder = launcher
      .filter((app) =>
        [app.name, app.description, app.id]
          .join("\n")
          .toLowerCase()
          .includes(needle)
      )
      .map((a) => a.id);

    const matchedOrder = matchApps(needle, nameOf).map((a) => a.id);

    // Sanity: the chosen needle matches more than one app so order is meaningful.
    expect(matchedOrder.length).toBeGreaterThan(1);
    expect(matchedOrder).toEqual(expectedOrder);
  });

  it("should use the injected nameOf for matching", () => {
    // A translation stub that renames PIM lets us match on the translated name.
    const translate = (app: AppConfig) =>
      app.id === "pim" ? "Gestione Prodotti" : app.name;

    const ids = matchApps("gestione prodotti", translate).map((a) => a.id);
    expect(ids).toContain("pim");

    // Without the stub, that translated phrase should not hit PIM by name.
    expect(matchApps("Gestione Prodotti", nameOf).map((a) => a.id)).not.toContain(
      "pim"
    );
  });
});
