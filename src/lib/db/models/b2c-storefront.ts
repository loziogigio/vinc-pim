/**
 * B2C Storefront Model
 *
 * Each tenant can have multiple B2C storefronts (websites),
 * each identified by its configured domains.
 * Includes branding, header, and footer configuration that
 * B2C frontends (Next.js, Nuxt.js, Flutter, etc.) can fetch via API.
 *
 * Stored in the tenant database (vinc-{tenant-id}).
 */

import { Schema } from "mongoose";

// ============================================
// CONSTANTS
// ============================================

export const STOREFRONT_STATUSES = ["active", "inactive"] as const;
export type StorefrontStatus = (typeof STOREFRONT_STATUSES)[number];

// ============================================
// BRANDING INTERFACES
// ============================================

export interface IB2CStorefrontBranding {
  /** Company / storefront title (browser tab, emails) */
  title?: string;
  /** Logo URL (SVG or PNG with transparent background) */
  logo_url?: string;
  /** Favicon URL (32x32 or 64x64 PNG/ICO) */
  favicon_url?: string;
  /** Primary brand color (buttons, highlights) */
  primary_color?: string;
  /** Secondary brand color (accents, hover states) */
  secondary_color?: string;
  /** Accent color (badges, alerts) */
  accent_color?: string;
  /** Body/heading font family */
  font_family?: string;
}

// ============================================
// HEADER INTERFACES
// ============================================

export interface IHeaderNavLink {
  label: string;
  href: string;
  open_in_new_tab?: boolean;
}

export interface IB2CStorefrontHeader {
  /** Show/hide the announcement bar */
  announcement_enabled?: boolean;
  /** Announcement bar text (e.g., "Free shipping over €50") */
  announcement_text?: string;
  /** Announcement bar link URL */
  announcement_link?: string;
  /** Announcement bar background color */
  announcement_bg_color?: string;
  /** Announcement bar text color */
  announcement_text_color?: string;
  /** Navigation links displayed in the header */
  nav_links?: IHeaderNavLink[];
  /** Show search bar in header */
  show_search?: boolean;
  /** Show cart icon in header */
  show_cart?: boolean;
  /** Show account/login in header */
  show_account?: boolean;
}

// ============================================
// FOOTER INTERFACES
// ============================================

export interface IFooterLink {
  label: string;
  href: string;
  open_in_new_tab?: boolean;
}

export interface IFooterColumn {
  title: string;
  links: IFooterLink[];
}

export interface IFooterSocial {
  platform: string;
  url: string;
}

export interface IB2CStorefrontFooter {
  /** Footer columns with link groups */
  columns?: IFooterColumn[];
  /** Social media links */
  social_links?: IFooterSocial[];
  /** Copyright / legal text (e.g., "© 2026 Company Srl - P.IVA 12345") */
  copyright_text?: string;
  /** Show newsletter signup in footer */
  show_newsletter?: boolean;
  /** Newsletter heading text */
  newsletter_heading?: string;
  /** Newsletter placeholder text */
  newsletter_placeholder?: string;
  /** Footer background color */
  bg_color?: string;
  /** Footer text color */
  text_color?: string;
}

// ============================================
// SETTINGS & MAIN INTERFACE
// ============================================

export interface IB2CStorefrontSettings {
  default_language?: string;
  theme?: string;
}

export interface IB2CStorefront {
  _id?: string;
  name: string;
  slug: string;
  domains: string[];
  status: StorefrontStatus;
  branding: IB2CStorefrontBranding;
  header: IB2CStorefrontHeader;
  footer: IB2CStorefrontFooter;
  settings: IB2CStorefrontSettings;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMAS
// ============================================

const HeaderNavLinkSchema = new Schema(
  {
    label: { type: String, required: true },
    href: { type: String, required: true },
    open_in_new_tab: { type: Boolean, default: false },
  },
  { _id: false }
);

const FooterLinkSchema = new Schema(
  {
    label: { type: String, required: true },
    href: { type: String, required: true },
    open_in_new_tab: { type: Boolean, default: false },
  },
  { _id: false }
);

const FooterColumnSchema = new Schema(
  {
    title: { type: String, required: true },
    links: { type: [FooterLinkSchema], default: [] },
  },
  { _id: false }
);

const FooterSocialSchema = new Schema(
  {
    platform: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const B2CStorefrontBrandingSchema = new Schema(
  {
    title: { type: String },
    logo_url: { type: String },
    favicon_url: { type: String },
    primary_color: { type: String },
    secondary_color: { type: String },
    accent_color: { type: String },
    font_family: { type: String },
  },
  { _id: false }
);

const B2CStorefrontHeaderSchema = new Schema(
  {
    announcement_enabled: { type: Boolean, default: false },
    announcement_text: { type: String },
    announcement_link: { type: String },
    announcement_bg_color: { type: String },
    announcement_text_color: { type: String },
    nav_links: { type: [HeaderNavLinkSchema], default: [] },
    show_search: { type: Boolean, default: true },
    show_cart: { type: Boolean, default: true },
    show_account: { type: Boolean, default: true },
  },
  { _id: false }
);

const B2CStorefrontFooterSchema = new Schema(
  {
    columns: { type: [FooterColumnSchema], default: [] },
    social_links: { type: [FooterSocialSchema], default: [] },
    copyright_text: { type: String },
    show_newsletter: { type: Boolean, default: false },
    newsletter_heading: { type: String },
    newsletter_placeholder: { type: String },
    bg_color: { type: String },
    text_color: { type: String },
  },
  { _id: false }
);

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
    branding: {
      type: B2CStorefrontBrandingSchema,
      default: () => ({}),
    },
    header: {
      type: B2CStorefrontHeaderSchema,
      default: () => ({
        show_search: true,
        show_cart: true,
        show_account: true,
      }),
    },
    footer: {
      type: B2CStorefrontFooterSchema,
      default: () => ({}),
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
