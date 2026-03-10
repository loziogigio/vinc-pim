/**
 * B2C Sitemap Model
 *
 * Stores per-storefront sitemap data: collected URLs, robots.txt config,
 * generation stats, and validation results.
 *
 * The actual sitemap.xml and robots.txt are generated on the B2C frontend
 * side — this model stores the structured data they need.
 *
 * Collection: b2csitemaps
 */

import { Schema } from "mongoose";

// ============================================
// CONSTANTS
// ============================================

export const SITEMAP_URL_TYPES = [
  "homepage",
  "page",
  "product",
  "category",
] as const;
export type SitemapUrlType = (typeof SITEMAP_URL_TYPES)[number];

export const CHANGEFREQ_VALUES = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;
export type ChangeFreq = (typeof CHANGEFREQ_VALUES)[number];

// ============================================
// INTERFACES
// ============================================

export interface ISitemapUrl {
  /** URL path relative to domain (e.g., "/products/sku-123") */
  path: string;
  /** URL type for grouping */
  type: SitemapUrlType;
  /** Last modification date */
  lastmod?: Date;
  /** Crawl frequency hint */
  changefreq: ChangeFreq;
  /** Priority 0.0–1.0 */
  priority: number;
  /** Alternate locale paths: { "it": "/it/products/...", "en": "/en/products/..." } */
  alternates?: Record<string, string>;
}

export interface ISitemapStats {
  total_urls: number;
  page_urls: number;
  product_urls: number;
  category_urls: number;
  homepage_urls: number;
  locales: string[];
  last_generated_at: Date;
  generation_duration_ms: number;
}

export interface ISitemapValidation {
  warnings: string[];
  errors: string[];
  last_validated_at: Date;
}

export interface IB2CSitemap {
  _id?: string;
  /** Which storefront this belongs to (unique) */
  storefront_slug: string;

  /** Structured URL entries for sitemap generation */
  urls: ISitemapUrl[];

  /** robots.txt configuration */
  robots_config: {
    /** Additional custom rules entered by admin */
    custom_rules: string;
    /** Paths to disallow (defaults applied at generation time) */
    disallow: string[];
  };

  /** Generation statistics */
  stats: ISitemapStats;

  /** Validation results */
  validation: ISitemapValidation;

  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const SitemapUrlSchema = new Schema(
  {
    path: { type: String, required: true },
    type: { type: String, enum: SITEMAP_URL_TYPES, required: true },
    lastmod: { type: Date },
    changefreq: { type: String, enum: CHANGEFREQ_VALUES, default: "weekly" },
    priority: { type: Number, default: 0.5, min: 0, max: 1 },
    alternates: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const B2CSitemapSchema = new Schema(
  {
    storefront_slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    urls: { type: [SitemapUrlSchema], default: [] },
    robots_config: {
      type: new Schema(
        {
          custom_rules: { type: String, default: "" },
          disallow: {
            type: [String],
            default: [
              // API & internal
              "/api/",
              "/admin/",
              "/preview/",
              // Search (dynamic, query-dependent)
              "/search",
              // Auth pages
              "/pages/login",
              "/pages/register",
              "/pages/forgot-password",
              "/pages/update-password",
              "/pages/confirm-subscription",
              // Account (auth-protected)
              "/pages/account",
              "/pages/address",
              "/pages/change-password",
              "/pages/orders",
              "/pages/profile",
              "/pages/reminders",
              "/pages/wishlist",
              // Checkout & payment
              "/pages/cart",
              "/pages/pay",
              "/pages/payment-success",
              "/pages/payment-failed",
              // Guest order (token-protected)
              "/public/orders/",
            ],
          },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    stats: {
      type: new Schema(
        {
          total_urls: { type: Number, default: 0 },
          page_urls: { type: Number, default: 0 },
          product_urls: { type: Number, default: 0 },
          category_urls: { type: Number, default: 0 },
          homepage_urls: { type: Number, default: 0 },
          locales: { type: [String], default: [] },
          last_generated_at: { type: Date },
          generation_duration_ms: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    validation: {
      type: new Schema(
        {
          warnings: { type: [String], default: [] },
          errors: { type: [String], default: [] },
          last_validated_at: { type: Date },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "b2csitemaps",
  }
);

// ============================================
// INDEXES
// ============================================

B2CSitemapSchema.index({ storefront_slug: 1 }, { unique: true });

export { B2CSitemapSchema };
