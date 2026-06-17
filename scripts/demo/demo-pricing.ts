/**
 * VINC Demo — generative per-persona pricing tiers.
 *
 * Differentiation is DATA, not runtime math: every packaging option carries a
 * tag-filtered pricing tier. search/route.ts picks the tier whose tag_filter
 * matches the logged-in customer's effective tags and rewrites product.pricing.
 *
 * premium (Rossi)  = list × 0.85 ; standard (Bianchi) = list × 0.93.
 * Bulk packs stack a further −8%/unit (matches the existing bulk discount).
 */
const CURRENCY = "EUR";
const cents = (n: number) => Math.round(n * 100) / 100;

export const DEMO_DISCOUNT_PREFIX = "categoria-di-sconto";
export const DEMO_TAG_PREMIUM = `${DEMO_DISCOUNT_PREFIX}:premium`;
export const DEMO_TAG_STANDARD = `${DEMO_DISCOUNT_PREFIX}:standard`;
export const PREMIUM_FACTOR = 0.85;
export const STANDARD_FACTOR = 0.93;
const BULK_UNIT_FACTOR = 0.92; // −8%/unit

/** Persona tier descriptor. `is_canonical_default` marks the ONE tier that is
 *  is_default:true in the raw doc (fix H) — we use the standard tier. */
export interface TierPricing {
  persona: "premium" | "standard";
  is_canonical_default: boolean;
  list: number;
  retail: number;
  list_unit?: number;
  retail_unit?: number;
  currency: string;
  vat_included: boolean;
  tag_filter: string[];
}

/** Two tag-filtered tiers for the single-piece option (standard is canonical default). */
export function buildPiecePricing(list: number, retail = list * 1.9): TierPricing[] {
  return [
    { persona: "premium", is_canonical_default: false, list: cents(list * PREMIUM_FACTOR), retail: cents(retail), currency: CURRENCY, vat_included: false, tag_filter: [DEMO_TAG_PREMIUM] },
    { persona: "standard", is_canonical_default: true, list: cents(list * STANDARD_FACTOR), retail: cents(retail), currency: CURRENCY, vat_included: false, tag_filter: [DEMO_TAG_STANDARD] },
  ];
}

/** Two tag-filtered tiers for a bulk pack of `qty`, stacking the bulk discount (standard is canonical default). */
export function buildPackPricing(list: number, qty: number, retail = list * 1.9): TierPricing[] {
  const mk = (factor: number, tag: string, persona: "premium" | "standard", canonical: boolean): TierPricing => {
    const unit = cents(list * factor * BULK_UNIT_FACTOR);
    return {
      persona, is_canonical_default: canonical,
      list: cents(unit * qty), retail: cents(retail * qty),
      list_unit: unit, retail_unit: cents(retail),
      currency: CURRENCY, vat_included: false, tag_filter: [tag],
    };
  };
  return [mk(PREMIUM_FACTOR, DEMO_TAG_PREMIUM, "premium", false), mk(STANDARD_FACTOR, DEMO_TAG_STANDARD, "standard", true)];
}
