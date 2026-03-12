/**
 * Coupon Type Definitions
 *
 * API request/response types for the coupon system.
 * Constants and enums re-exported from @/lib/constants/coupon.
 */

import type { IOrder } from "@/lib/db/models/order";

// Re-export constants for convenience
export type {
  CouponStatus,
  CouponDiscountType,
  CouponScopeType,
} from "@/lib/constants/coupon";

export {
  COUPON_STATUSES,
  COUPON_DISCOUNT_TYPES,
  COUPON_SCOPE_TYPES,
  COUPON_STATUS_LABELS,
  COUPON_DISCOUNT_TYPE_LABELS,
  COUPON_SCOPE_LABELS,
} from "@/lib/constants/coupon";

// ============================================
// API REQUEST TYPES
// ============================================

export interface CreateCouponRequest {
  code: string;
  /** Sales channel code (mandatory) */
  channel: string;
  description?: string;
  label?: string;
  start_date?: string; // ISO date
  end_date?: string;
  max_uses?: number;
  max_uses_per_customer?: number;
  customer_emails?: string[];
  discount_type: "percentage" | "fixed";
  discount_value: number;
  scope_type?: "order"; // MVP: only "order" supported
  scope_values?: string[];
  include_shipping?: boolean;
  is_cumulative?: boolean;
  min_order_amount?: number;
  max_order_amount?: number;
  max_discount_amount?: number;
  notes?: string;
}

export interface UpdateCouponRequest extends Partial<CreateCouponRequest> {
  status?: "active" | "inactive";
}

export interface ValidateCouponRequest {
  code: string;
  order_id: string;
}

export interface ApplyCouponRequest {
  code: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: {
    coupon_id: string;
    code: string;
    label?: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    scope_type: "order";
    estimated_discount: number;
  };
}

export interface ApplyCouponResult {
  success: boolean;
  error?: string;
  order?: IOrder;
  discount_applied: number;
}
