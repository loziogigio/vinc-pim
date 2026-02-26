import { describe, it, expect } from "vitest";
import {
  computeMethodCost,
  findZoneForCountry,
  getAvailableShippingOptions,
} from "@/lib/services/delivery-cost.service";
import type {
  IShippingConfig,
  IShippingMethod,
} from "@/lib/types/shipping";

// ============================================
// TEST FIXTURES — Italy example from spec
// ============================================

const pickupMethod: IShippingMethod = {
  method_id: "pickup01",
  name: "Pick up",
  tiers: [{ min_subtotal: 0, rate: 0 }],
  enabled: true,
};

const payAtDeliveryMethod: IShippingMethod = {
  method_id: "cod0001",
  name: "Pay at delivery",
  tiers: [
    { min_subtotal: 100, rate: 7 },
    { min_subtotal: 0, rate: 17 },
  ],
  enabled: true,
};

const homeDeliveryMethod: IShippingMethod = {
  method_id: "home001",
  name: "Home delivery",
  tiers: [
    { min_subtotal: 100, rate: 0 },
    { min_subtotal: 0, rate: 7 },
  ],
  enabled: true,
};

const disabledMethod: IShippingMethod = {
  method_id: "dis0001",
  name: "Disabled method",
  tiers: [{ min_subtotal: 0, rate: 5 }],
  enabled: false,
};

const italyConfig: IShippingConfig = {
  zones: [
    {
      zone_id: "zone01",
      name: "Italy",
      countries: ["IT"],
      methods: [pickupMethod, payAtDeliveryMethod, homeDeliveryMethod, disabledMethod],
    },
    {
      zone_id: "zone02",
      name: "Rest of World",
      countries: ["*"],
      methods: [
        {
          method_id: "intl001",
          name: "International Courier",
          carrier: "DHL",
          tiers: [{ min_subtotal: 0, rate: 25 }],
          enabled: true,
        },
      ],
    },
  ],
  updated_at: new Date(),
};

// ============================================
// computeMethodCost
// ============================================

describe("unit: computeMethodCost", () => {
  it("pick up — any subtotal returns 0", () => {
    expect(computeMethodCost(pickupMethod, 0)).toBe(0);
    expect(computeMethodCost(pickupMethod, 50)).toBe(0);
    expect(computeMethodCost(pickupMethod, 200)).toBe(0);
  });

  it("pay at delivery — subtotal >= 100 returns 7", () => {
    expect(computeMethodCost(payAtDeliveryMethod, 100)).toBe(7);
    expect(computeMethodCost(payAtDeliveryMethod, 120)).toBe(7);
    expect(computeMethodCost(payAtDeliveryMethod, 500)).toBe(7);
  });

  it("pay at delivery — subtotal < 100 returns 17", () => {
    expect(computeMethodCost(payAtDeliveryMethod, 0)).toBe(17);
    expect(computeMethodCost(payAtDeliveryMethod, 80)).toBe(17);
    expect(computeMethodCost(payAtDeliveryMethod, 99.99)).toBe(17);
  });

  it("home delivery — subtotal >= 100 returns 0 (free)", () => {
    expect(computeMethodCost(homeDeliveryMethod, 100)).toBe(0);
    expect(computeMethodCost(homeDeliveryMethod, 150)).toBe(0);
  });

  it("home delivery — subtotal < 100 returns 7", () => {
    expect(computeMethodCost(homeDeliveryMethod, 0)).toBe(7);
    expect(computeMethodCost(homeDeliveryMethod, 50)).toBe(7);
    expect(computeMethodCost(homeDeliveryMethod, 99)).toBe(7);
  });

  it("tiers in any order — still evaluates correctly", () => {
    // Tiers stored ascending — should still sort and pick correctly
    const shuffledTiers: IShippingMethod = {
      ...payAtDeliveryMethod,
      tiers: [
        { min_subtotal: 0, rate: 17 },   // stored ascending
        { min_subtotal: 100, rate: 7 },
      ],
    };
    expect(computeMethodCost(shuffledTiers, 120)).toBe(7);
    expect(computeMethodCost(shuffledTiers, 80)).toBe(17);
  });
});

// ============================================
// findZoneForCountry
// ============================================

describe("unit: findZoneForCountry", () => {
  it("exact match — IT resolves to Italy zone", () => {
    const zone = findZoneForCountry(italyConfig, "IT");
    expect(zone?.name).toBe("Italy");
  });

  it("exact match — case insensitive (lowercase input)", () => {
    const zone = findZoneForCountry(italyConfig, "it");
    expect(zone?.name).toBe("Italy");
  });

  it("wildcard fallback — unknown country resolves to Rest of World", () => {
    const zone = findZoneForCountry(italyConfig, "JP");
    expect(zone?.name).toBe("Rest of World");
  });

  it("no zone and no wildcard — returns null", () => {
    const configWithoutWildcard: IShippingConfig = {
      zones: [{ zone_id: "z1", name: "Italy", countries: ["IT"], methods: [] }],
      updated_at: new Date(),
    };
    const zone = findZoneForCountry(configWithoutWildcard, "DE");
    expect(zone).toBeNull();
  });

  it("empty zones — returns null", () => {
    const emptyConfig: IShippingConfig = { zones: [], updated_at: new Date() };
    expect(findZoneForCountry(emptyConfig, "IT")).toBeNull();
  });
});

// ============================================
// getAvailableShippingOptions
// ============================================

describe("unit: getAvailableShippingOptions", () => {
  it("returns enabled methods only — disabled method excluded", () => {
    const options = getAvailableShippingOptions(italyConfig, "IT", 50);
    const ids = options.map((o) => o.method_id);
    expect(ids).not.toContain("dis0001");
    expect(ids).toContain("pickup01");
    expect(ids).toContain("cod0001");
    expect(ids).toContain("home001");
  });

  it("computes correct costs at subtotal 80 (below threshold)", () => {
    const options = getAvailableShippingOptions(italyConfig, "IT", 80);
    const byId = Object.fromEntries(options.map((o) => [o.method_id, o]));
    expect(byId["pickup01"].computed_cost).toBe(0);
    expect(byId["pickup01"].is_free).toBe(true);
    expect(byId["cod0001"].computed_cost).toBe(17);
    expect(byId["cod0001"].is_free).toBe(false);
    expect(byId["home001"].computed_cost).toBe(7);
    expect(byId["home001"].is_free).toBe(false);
  });

  it("computes correct costs at subtotal 120 (above threshold)", () => {
    const options = getAvailableShippingOptions(italyConfig, "IT", 120);
    const byId = Object.fromEntries(options.map((o) => [o.method_id, o]));
    expect(byId["pickup01"].computed_cost).toBe(0);
    expect(byId["cod0001"].computed_cost).toBe(7);
    expect(byId["home001"].computed_cost).toBe(0);
    expect(byId["home001"].is_free).toBe(true);
  });

  it("falls through to wildcard zone for unknown country", () => {
    const options = getAvailableShippingOptions(italyConfig, "DE", 50);
    expect(options).toHaveLength(1);
    expect(options[0].name).toBe("International Courier");
    expect(options[0].computed_cost).toBe(25);
  });

  it("returns empty array for empty country code", () => {
    const options = getAvailableShippingOptions(italyConfig, "", 50);
    expect(options).toHaveLength(0);
  });

  it("returns empty array when no matching zone", () => {
    const configNoWildcard: IShippingConfig = {
      zones: [{ zone_id: "z1", name: "Italy", countries: ["IT"], methods: [pickupMethod] }],
      updated_at: new Date(),
    };
    const options = getAvailableShippingOptions(configNoWildcard, "DE", 50);
    expect(options).toHaveLength(0);
  });
});
