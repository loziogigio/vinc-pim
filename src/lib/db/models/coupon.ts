/**
 * Coupon Model
 *
 * Extensible coupon/discount code system for B2B e-commerce.
 * Supports order-level discounts (percentage or fixed), customer restrictions,
 * usage limits, time bounds, and cumulative behavior control.
 *
 * Collection: coupons (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";
import {
  COUPON_STATUSES,
  COUPON_DISCOUNT_TYPES,
  COUPON_SCOPE_TYPES,
} from "@/lib/constants/coupon";
import type {
  CouponStatus,
  CouponDiscountType,
  CouponScopeType,
} from "@/lib/constants/coupon";

// ============================================
// INTERFACES
// ============================================

export interface ICouponUsageRecord {
  order_id: string;
  customer_id?: string;
  used_at: Date;
  discount_amount: number;
}

export interface ICoupon {
  // Identity
  coupon_id: string;
  code: string;

  /** Sales channel code this coupon applies to (mandatory) */
  channel: string;

  // Description / info
  description?: string;
  label?: string;

  // Status
  status: CouponStatus;

  // Validity
  start_date?: Date;
  end_date?: Date;

  // Usage limits
  max_uses?: number;
  max_uses_per_customer?: number;
  usage_count: number;
  usage_history: ICouponUsageRecord[];

  // Customer restriction (by email, supports guests too)
  customer_emails?: string[];

  // Discount
  discount_type: CouponDiscountType;
  discount_value: number;

  // Scope (MVP: order-level only)
  scope_type: CouponScopeType;
  scope_values?: string[];

  // Order-level options
  include_shipping: boolean;

  // Cumulative behavior
  is_cumulative: boolean;

  // Order thresholds
  min_order_amount?: number;
  max_order_amount?: number;

  // Discount cap
  max_discount_amount?: number;

  // Metadata
  notes?: string;
  created_by?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface ICouponDocument extends ICoupon, Document {}

// ============================================
// SUB-SCHEMAS
// ============================================

const UsageRecordSchema = new Schema<ICouponUsageRecord>(
  {
    order_id: { type: String, required: true },
    customer_id: { type: String },
    used_at: { type: Date, required: true, default: Date.now },
    discount_amount: { type: Number, required: true },
  },
  { _id: false }
);

// ============================================
// SCHEMA
// ============================================

const CouponSchema = new Schema<ICouponDocument>(
  {
    coupon_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `cpn_${nanoid(10)}`,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    // Sales channel (mandatory)
    channel: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // Description
    description: { type: String },
    label: { type: String, trim: true, maxlength: 200 },

    // Status
    status: {
      type: String,
      required: true,
      enum: COUPON_STATUSES,
      default: "active",
    },

    // Validity
    start_date: { type: Date },
    end_date: { type: Date },

    // Usage limits
    max_uses: { type: Number, min: 1 },
    max_uses_per_customer: { type: Number, min: 1 },
    usage_count: { type: Number, default: 0, min: 0 },
    usage_history: { type: [UsageRecordSchema], default: [] },

    // Customer restriction (by email — works for registered & guest users)
    customer_emails: { type: [String], default: [] },

    // Discount
    discount_type: {
      type: String,
      required: true,
      enum: COUPON_DISCOUNT_TYPES,
    },
    discount_value: {
      type: Number,
      required: true,
      min: 0,
    },

    // Scope
    scope_type: {
      type: String,
      required: true,
      enum: COUPON_SCOPE_TYPES,
      default: "order",
    },
    scope_values: { type: [String], default: [] },

    // Order-level options
    include_shipping: { type: Boolean, default: false },

    // Cumulative
    is_cumulative: { type: Boolean, default: true },

    // Order thresholds
    min_order_amount: { type: Number, min: 0 },
    max_order_amount: { type: Number, min: 0 },

    // Discount cap
    max_discount_amount: { type: Number, min: 0 },

    // Metadata
    notes: { type: String, trim: true, maxlength: 1000 },
    created_by: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

CouponSchema.index({ channel: 1, status: 1 });
CouponSchema.index({ status: 1 });
CouponSchema.index({ customer_emails: 1 });
CouponSchema.index({ start_date: 1, end_date: 1 });

// ============================================
// EXPORT
// ============================================

export { CouponSchema };

export const CouponModel =
  mongoose.models.Coupon ||
  mongoose.model<ICouponDocument>("Coupon", CouponSchema);
