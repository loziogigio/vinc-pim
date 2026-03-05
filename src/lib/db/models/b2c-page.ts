/**
 * B2C Page Model
 *
 * Lightweight page registry for B2C storefronts.
 * Stores metadata only — actual page content (blocks) lives in
 * the HomeTemplate collection via templateId: "b2c-{storefront}-page-{slug}".
 *
 * Collection: b2cpages
 */

import { Schema } from "mongoose";

// ============================================
// CONSTANTS
// ============================================

export const PAGE_STATUSES = ["active", "inactive"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

// ============================================
// INTERFACE
// ============================================

export interface IB2CPage {
  _id?: string;
  /** Storefront this page belongs to */
  storefront_slug: string;
  /** URL slug for this page (e.g., "about", "contact") */
  slug: string;
  /** Display title */
  title: string;
  /** Whether page is active */
  status: PageStatus;
  /** Whether to show in storefront navigation */
  show_in_nav: boolean;
  /** Sort order for navigation display */
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const B2CPageSchema = new Schema(
  {
    storefront_slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with dashes",
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PAGE_STATUSES,
      default: "active",
    },
    show_in_nav: {
      type: Boolean,
      default: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "b2cpages",
  }
);

// ============================================
// INDEXES
// ============================================

B2CPageSchema.index({ storefront_slug: 1, slug: 1 }, { unique: true });
B2CPageSchema.index({ storefront_slug: 1, sort_order: 1 });

export { B2CPageSchema };
