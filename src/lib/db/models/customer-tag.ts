/**
 * CustomerTag Model
 *
 * Structured tags for customer segmentation with prefix:code format.
 * Used for price list visibility, promotion filtering, and campaign targeting.
 *
 * Tags are assigned to customers (default) and optionally overridden per delivery address.
 *
 * Collection: customertags (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";
import { buildFullTag } from "@/lib/constants/customer-tag";

// ============================================
// INTERFACES
// ============================================

export interface ICustomerTag {
  tag_id: string;
  /** Category prefix (e.g., "categoria-di-sconto") */
  prefix: string;
  /** Value code (e.g., "sconto-45") */
  code: string;
  /** Computed: "prefix:code" (e.g., "categoria-di-sconto:sconto-45") */
  full_tag: string;
  /** Human-readable label (e.g., "Sconto base 45%") */
  description: string;
  color?: string;
  is_active: boolean;
  /** Number of customers with this tag (customer-level + address-level) */
  customer_count: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface ICustomerTagDocument extends ICustomerTag, Document {}

/**
 * Lightweight embedded reference for Customer and Address documents.
 */
export interface ICustomerTagRef {
  tag_id: string;
  full_tag: string;
  prefix: string;
  code: string;
}

// ============================================
// SCHEMA
// ============================================

const CustomerTagSchema = new Schema<ICustomerTagDocument>(
  {
    tag_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `ctag_${nanoid(8)}`,
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    full_tag: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    customer_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    created_by: { type: String },
    updated_by: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

CustomerTagSchema.index({ full_tag: 1 }, { unique: true });
CustomerTagSchema.index({ prefix: 1, code: 1 }, { unique: true });
CustomerTagSchema.index({ prefix: 1 });
CustomerTagSchema.index({ is_active: 1 });

// ============================================
// HOOKS
// ============================================

CustomerTagSchema.pre("save", function (next) {
  if (this.isModified("prefix") || this.isModified("code") || !this.full_tag) {
    this.full_tag = buildFullTag(this.prefix, this.code);
  }
  next();
});

// ============================================
// EMBEDDED REF SCHEMA (for Customer / Address)
// ============================================

const CustomerTagRefSchema = new Schema<ICustomerTagRef>(
  {
    tag_id: { type: String, required: true },
    full_tag: { type: String, required: true },
    prefix: { type: String, required: true },
    code: { type: String, required: true },
  },
  { _id: false }
);

// ============================================
// EXPORT
// ============================================

export { CustomerTagSchema, CustomerTagRefSchema };

export const CustomerTagModel =
  mongoose.models.CustomerTag ||
  mongoose.model<ICustomerTagDocument>("CustomerTag", CustomerTagSchema);
