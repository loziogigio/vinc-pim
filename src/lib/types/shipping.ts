/**
 * Shipping / Delivery Cost Types
 *
 * Per-tenant shipping zone and method configuration with tiered pricing.
 * Stored in the tenant database (vinc-{tenant-id}) in the b2bshippingconfig collection.
 */

/**
 * A single pricing tier for a shipping method.
 *
 * Algorithm: sort tiers descending by min_subtotal, return rate of first
 * tier where order subtotal_net >= min_subtotal.
 *
 * Example for "Pay at delivery":
 *   [{ min_subtotal: 100, rate: 7 }, { min_subtotal: 0, rate: 17 }]
 *   → subtotal 120 → €7, subtotal 80 → €17
 */
export interface IShippingTier {
  /** Minimum order subtotal_net (inclusive) to activate this tier */
  min_subtotal: number;
  /** Cost in tenant currency (0 = free shipping) */
  rate: number;
}

export interface IShippingMethod {
  /** Unique identifier — nanoid(8), generated on save */
  method_id: string;
  /** Display name, e.g. "Pick up", "Pay at delivery", "Home delivery" */
  name: string;
  /** Optional carrier label, e.g. "BRT", "GLS", "DHL" */
  carrier?: string;
  /**
   * Rate tiers — must include at least one tier with min_subtotal: 0.
   * Stored in any order; calculator always sorts descending before evaluating.
   */
  tiers: IShippingTier[];
  /** Estimated minimum delivery days */
  estimated_days_min?: number;
  /** Estimated maximum delivery days */
  estimated_days_max?: number;
  /** Whether this method is currently offered to customers */
  enabled: boolean;
}

export interface IShippingZone {
  /** Unique identifier — nanoid(8), generated on save */
  zone_id: string;
  /** Display name, e.g. "Italy", "Europe", "Rest of World" */
  name: string;
  /**
   * ISO 3166-1 alpha-2 country codes covered by this zone.
   * Use ["*"] as a catch-all fallback zone.
   */
  countries: string[];
  methods: IShippingMethod[];
}

export interface IShippingConfig {
  zones: IShippingZone[];
  updated_at: Date;
}

/**
 * Read model returned by GET /api/b2b/orders/[id]/shipping-options.
 * Contains pre-computed cost for the current order subtotal.
 */
export interface ShippingMethodOption {
  method_id: string;
  name: string;
  carrier?: string;
  /** Cost for the current order subtotal after tier evaluation */
  computed_cost: number;
  /** True when computed_cost === 0 */
  is_free: boolean;
  estimated_days_min?: number;
  estimated_days_max?: number;
}
