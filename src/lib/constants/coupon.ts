/**
 * Coupon Constants
 *
 * Single source of truth for coupon-related enumerations.
 * Following CLAUDE.md guidelines for constants management.
 */

// ============================================
// COUPON STATUS
// ============================================

export const COUPON_STATUSES = [
  "active", // Can be used
  "inactive", // Manually disabled by admin
  "expired", // Past end_date
  "depleted", // max_uses reached
] as const;

export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  active: "Attivo",
  inactive: "Disattivato",
  expired: "Scaduto",
  depleted: "Esaurito",
};

// ============================================
// DISCOUNT TYPES
// ============================================

export const COUPON_DISCOUNT_TYPES = ["percentage", "fixed"] as const;

export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

export const COUPON_DISCOUNT_TYPE_LABELS: Record<CouponDiscountType, string> = {
  percentage: "Percentuale",
  fixed: "Valore fisso",
};

// ============================================
// SCOPE TYPES
// ============================================

// MVP: order-level only. Product scopes (product_item, product_type, brand, collection)
// deferred to future iteration.
export const COUPON_SCOPE_TYPES = ["order"] as const;

export type CouponScopeType = (typeof COUPON_SCOPE_TYPES)[number];

export const COUPON_SCOPE_LABELS: Record<CouponScopeType, string> = {
  order: "Intero ordine",
};
