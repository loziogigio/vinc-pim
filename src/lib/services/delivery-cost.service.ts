/**
 * Delivery Cost Service
 *
 * Pure functions for zone matching and tier-based cost computation,
 * plus DB-aware wrappers for fetching and saving shipping configuration.
 *
 * Algorithm:
 *   Sort method tiers descending by min_subtotal.
 *   Return rate of first tier where subtotal_net >= min_subtotal.
 */

import { connectWithModels } from "@/lib/db/connection";
import type {
  IShippingConfig,
  IShippingZone,
  IShippingMethod,
  ShippingMethodOption,
} from "@/lib/types/shipping";

// ============================================
// PURE CALCULATOR FUNCTIONS (unit-testable)
// ============================================

/**
 * Compute the delivery cost for a method given the order subtotal.
 *
 * Walks tiers sorted descending by min_subtotal and returns the rate
 * of the first tier where subtotalNet >= min_subtotal.
 *
 * Examples:
 *   Pay at delivery tiers: [{min: 100, rate: 7}, {min: 0, rate: 17}]
 *     subtotal 120 → 7, subtotal 80 → 17
 *
 *   Home delivery tiers: [{min: 100, rate: 0}, {min: 0, rate: 7}]
 *     subtotal 150 → 0 (free), subtotal 50 → 7
 */
export function computeMethodCost(
  method: IShippingMethod,
  subtotalNet: number
): number {
  const sorted = [...method.tiers].sort(
    (a, b) => b.min_subtotal - a.min_subtotal
  );
  const match = sorted.find((t) => subtotalNet >= t.min_subtotal);
  // Fallback: use lowest tier if nothing matched (subtotal < all min_subtotals)
  return match !== undefined ? match.rate : (sorted[sorted.length - 1]?.rate ?? 0);
}

/**
 * Find the shipping zone for a given country code.
 *
 * Precedence:
 *   1. Exact country code match (e.g. "IT" in zone.countries)
 *   2. Wildcard catch-all zone (countries includes "*")
 *   3. null — no zone available for this country
 */
export function findZoneForCountry(
  config: IShippingConfig,
  countryCode: string
): IShippingZone | null {
  const upper = countryCode.toUpperCase();

  // Exact match first
  const exact = config.zones.find((z) => z.countries.includes(upper));
  if (exact) return exact;

  // Wildcard catch-all
  const catchAll = config.zones.find((z) => z.countries.includes("*"));
  return catchAll ?? null;
}

/**
 * Return all enabled shipping methods for a country + subtotal combination,
 * with pre-computed costs.
 *
 * Returns empty array if:
 *   - countryCode is empty
 *   - no zone found for the country
 *   - no enabled methods in the zone
 */
export function getAvailableShippingOptions(
  config: IShippingConfig,
  countryCode: string,
  subtotalNet: number
): ShippingMethodOption[] {
  if (!countryCode) return [];

  const zone = findZoneForCountry(config, countryCode);
  if (!zone) return [];

  return zone.methods
    .filter((m) => m.enabled)
    .map((m) => {
      const computed_cost = computeMethodCost(m, subtotalNet);
      return {
        method_id: m.method_id,
        name: m.name,
        carrier: m.carrier,
        computed_cost,
        is_free: computed_cost === 0,
        estimated_days_min: m.estimated_days_min,
        estimated_days_max: m.estimated_days_max,
      };
    });
}

// ============================================
// DB-AWARE WRAPPERS
// ============================================

/**
 * Fetch shipping config from tenant database.
 * Returns null if not yet configured.
 */
export async function fetchShippingConfig(
  tenantDb: string
): Promise<IShippingConfig | null> {
  const { ShippingConfig } = await connectWithModels(tenantDb);
  const doc = await ShippingConfig.findOne().lean<IShippingConfig>();
  return doc ?? null;
}

/**
 * Upsert the full shipping configuration for a tenant.
 * Replaces all zones atomically.
 */
export async function saveShippingConfig(
  tenantDb: string,
  data: Pick<IShippingConfig, "zones">
): Promise<IShippingConfig> {
  const { ShippingConfig } = await connectWithModels(tenantDb);

  const existing = await ShippingConfig.findOne();
  if (existing) {
    existing.zones = data.zones as typeof existing.zones;
    await existing.save();
    return existing.toObject() as IShippingConfig;
  }

  const created = await ShippingConfig.create({ zones: data.zones });
  return created.toObject() as IShippingConfig;
}
