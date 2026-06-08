/**
 * B2B Page Model
 *
 * Lightweight page registry for B2B portals.
 * Stores metadata only — actual page content (blocks) lives in
 * the HomeTemplate collection via templateId: "b2b-{portal}-page-{slug}".
 *
 * Collection: b2bpages
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

export interface IB2BPage {
  _id?: string;
  /** Portal this page belongs to */
  portal_slug: string;
  /** URL slug for this page (e.g., "about", "contact") */
  slug: string;
  /** Display title */
  title: string;
  /** Catalog language this page belongs to (it/de/en/cs/sk). One page = one language. */
  lang: string;
  /** Whether page is active */
  status: PageStatus;
  /** Whether to show in portal navigation */
  show_in_nav: boolean;
  /** Sort order for navigation display */
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const B2BPageSchema = new Schema(
  {
    portal_slug: {
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
    lang: { type: String, required: true, trim: true, lowercase: true },
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
    collection: "b2bpages",
  }
);

// ============================================
// INDEXES
// ============================================

B2BPageSchema.index({ portal_slug: 1, slug: 1 }, { unique: true });
B2BPageSchema.index({ portal_slug: 1, sort_order: 1 });

export { B2BPageSchema };
