/**
 * SalesChannel Model
 *
 * Tenant-configurable sales channels for visibility/publication scope.
 * Each tenant defines their own channels (e.g., "b2b", "slovakia", "ebay").
 * One channel per tenant is marked as default (is_default: true).
 *
 * Collection: saleschannels (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";

// ============================================
// INTERFACES
// ============================================

export interface ISalesChannel {
  /** Unique identifier: "ch_{nanoid(8)}" */
  channel_id: string;
  /** Kebab-case unique key (e.g., "b2b", "slovakia", "ebay") */
  code: string;
  /** Human-readable name (e.g., "B2B Wholesale", "Slovakia") */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional color for UI badges */
  color?: string;
  /** Only ONE channel per tenant can be default */
  is_default: boolean;
  /** Soft-disable without deleting */
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ISalesChannelDocument extends ISalesChannel, Document {}

// ============================================
// SCHEMA
// ============================================

const SalesChannelSchema = new Schema<ISalesChannelDocument>(
  {
    channel_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `ch_${nanoid(8)}`,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    is_default: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

SalesChannelSchema.index({ code: 1 }, { unique: true });
SalesChannelSchema.index({ is_active: 1 });
SalesChannelSchema.index({ is_default: 1 });

// ============================================
// EXPORT
// ============================================

export { SalesChannelSchema };

export const SalesChannelModel =
  mongoose.models.SalesChannel ||
  mongoose.model<ISalesChannelDocument>("SalesChannel", SalesChannelSchema);
