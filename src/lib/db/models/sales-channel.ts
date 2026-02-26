/**
 * Sales Channel Model
 *
 * MongoDB model for sales channels. Each tenant can have multiple channels
 * (e.g., b2b, b2c, ebay, amazon) to segment portal users and customers.
 *
 * Collection: saleschannels (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";

// ============================================
// INTERFACES
// ============================================

export interface ISalesChannel {
  code: string;
  name: string;
  description?: string;
  color?: string;
  is_default: boolean;
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
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
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

SalesChannelSchema.index({ is_active: 1, is_default: -1, code: 1 });

// ============================================
// EXPORT
// ============================================

export { SalesChannelSchema };
