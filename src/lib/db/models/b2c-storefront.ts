/**
 * B2C Storefront Model
 *
 * Each tenant can have multiple B2C storefronts (websites),
 * each identified by its configured domains.
 * Stored in the tenant database (vinc-{tenant-id}).
 */

import { Schema } from "mongoose";

// ============================================
// CONSTANTS
// ============================================

export const STOREFRONT_STATUSES = ["active", "inactive"] as const;
export type StorefrontStatus = (typeof STOREFRONT_STATUSES)[number];

// ============================================
// INTERFACE
// ============================================

export interface IB2CStorefrontSettings {
  default_language?: string;
  theme?: string;
}

export interface IB2CStorefront {
  name: string;
  slug: string;
  domains: string[];
  status: StorefrontStatus;
  settings: IB2CStorefrontSettings;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const B2CStorefrontSettingsSchema = new Schema(
  {
    default_language: { type: String },
    theme: { type: String },
  },
  { _id: false }
);

const B2CStorefrontSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with dashes",
      ],
    },
    domains: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: STOREFRONT_STATUSES,
      default: "active",
    },
    settings: {
      type: B2CStorefrontSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "b2cstorefronts",
  }
);

// ============================================
// INDEXES
// ============================================

B2CStorefrontSchema.index({ slug: 1 }, { unique: true });
B2CStorefrontSchema.index({ domains: 1 });
B2CStorefrontSchema.index({ status: 1 });

export { B2CStorefrontSchema };
