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
import type {
  HeaderConfig,
  HeaderRow,
  HeaderBlock,
  HeaderWidget,
  RowLayout,
  BlockAlignment,
} from "@/lib/types/home-settings";

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
  /** Show favorites/wishlist icon in header */
  show_favorites?: boolean;
  /** Show reminders icon in header */
  show_reminders?: boolean;
}

// ============================================
// FOOTER INTERFACES
// ============================================

export interface IFooterLink {
  label: string;
  href: string;
  open_in_new_tab?: boolean;
}

export const FOOTER_ITEM_TYPES = ["text", "image", "link"] as const;
export type FooterItemType = (typeof FOOTER_ITEM_TYPES)[number];

/** A single content item inside a footer column (text, image, or link) */
export interface IFooterColumnItem {
  type: FooterItemType;
  /** Text/HTML content (type: "text") */
  text_content?: string;
  /** Image URL (type: "image") */
  image_url?: string;
  /** Alt text for image (type: "image") */
  image_alt?: string;
  /** Max width of image in px (type: "image", default 200) */
  image_max_width?: number;
  /** Link label (type: "link") */
  label?: string;
  /** Link href (type: "link") */
  href?: string;
  /** Open link in new tab (type: "link") */
  open_in_new_tab?: boolean;
}

export interface IFooterColumn {
  title: string;
  /** Mixed content items — when present, takes priority over links */
  items?: IFooterColumnItem[];
  /** Legacy links array — kept for backward compatibility */
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
  /** Full HTML footer content (published) — when set, overrides structured columns */
  footer_html?: string;
  /** Full HTML footer content (draft) */
  footer_html_draft?: string;
}

// ============================================
// CUSTOM SCRIPTS
// ============================================

export const SCRIPT_PLACEMENTS = ["head", "body_end"] as const;
export type ScriptPlacement = (typeof SCRIPT_PLACEMENTS)[number];

export const SCRIPT_LOADING_STRATEGIES = ["async", "defer", "blocking"] as const;
export type ScriptLoadingStrategy = (typeof SCRIPT_LOADING_STRATEGIES)[number];

export interface IB2CCustomScript {
  /** Human-readable label (e.g., "Google Analytics", "Iubenda") */
  label: string;
  /** External script URL (e.g., https://www.googletagmanager.com/gtag/js?id=G-XXX) */
  src?: string;
  /** Inline script content (e.g., gtag('config', 'G-XXX')) — can be combined with src */
  inline_code?: string;
  /** Where to inject: head (default) or body_end */
  placement: ScriptPlacement;
  /** Loading strategy for external scripts: async (default), defer, blocking */
  loading_strategy: ScriptLoadingStrategy;
  /** Toggle on/off without deleting */
  enabled: boolean;
}

// ============================================
// SEO META TAGS INTERFACE
// ============================================

export interface IB2CStorefrontMetaTags {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  robots?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_site_name?: string;
  og_type?: string;
  twitter_card?: string;
  twitter_site?: string;
  twitter_creator?: string;
  twitter_image?: string;
  theme_color?: string;
  google_site_verification?: string;
  bing_site_verification?: string;
  structured_data?: string;
}

// ============================================
// DOMAIN INTERFACE
// ============================================

export interface IStorefrontDomain {
  /** Hostname or full URL (e.g., "shop.example.com") */
  domain: string;
  /** Only one domain per storefront should be primary (the official/active one) */
  is_primary: boolean;
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
  /** Sales channel code (e.g., "b2c", "b2c-de") — links storefront to its channel */
  channel: string;
  /** Structured domains with primary flag */
  domains: IStorefrontDomain[];
  status: StorefrontStatus;
  branding: IB2CStorefrontBranding;
  /** Legacy simple header (announcement bar, nav links, toggles) */
  header: IB2CStorefrontHeader;
  /** Row/block/widget header builder config (published) */
  header_config?: HeaderConfig;
  /** Row/block/widget header builder config (draft) */
  header_config_draft?: HeaderConfig;
  /** Published footer */
  footer: IB2CStorefrontFooter;
  /** Draft footer (same structure as footer, for preview before publishing) */
  footer_draft?: IB2CStorefrontFooter;
  /** SEO meta tags */
  meta_tags?: IB2CStorefrontMetaTags;
  /** Third-party scripts (analytics, cookie consent, tracking pixels, etc.) */
  custom_scripts?: IB2CCustomScript[];
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

const FooterColumnItemSchema = new Schema(
  {
    type: { type: String, enum: FOOTER_ITEM_TYPES, required: true },
    text_content: { type: String },
    image_url: { type: String },
    image_alt: { type: String },
    image_max_width: { type: Number },
    label: { type: String },
    href: { type: String },
    open_in_new_tab: { type: Boolean, default: false },
  },
  { _id: false }
);

const FooterColumnSchema = new Schema(
  {
    title: { type: String, required: true },
    items: { type: [FooterColumnItemSchema], default: undefined },
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
    show_favorites: { type: Boolean, default: true },
    show_reminders: { type: Boolean, default: true },
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
    footer_html: { type: String },
    footer_html_draft: { type: String },
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

const B2CStorefrontMetaTagsSchema = new Schema(
  {
    title: { type: String },
    description: { type: String },
    keywords: { type: String },
    author: { type: String },
    robots: { type: String },
    canonical_url: { type: String },
    og_title: { type: String },
    og_description: { type: String },
    og_image: { type: String },
    og_site_name: { type: String },
    og_type: { type: String },
    twitter_card: { type: String },
    twitter_site: { type: String },
    twitter_creator: { type: String },
    twitter_image: { type: String },
    theme_color: { type: String },
    google_site_verification: { type: String },
    bing_site_verification: { type: String },
    structured_data: { type: String },
  },
  { _id: false }
);

const CustomScriptSchema = new Schema(
  {
    label: { type: String, required: true },
    src: { type: String },
    inline_code: { type: String },
    placement: { type: String, enum: SCRIPT_PLACEMENTS, default: "head" },
    loading_strategy: { type: String, enum: SCRIPT_LOADING_STRATEGIES, default: "async" },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const HeaderWidgetSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const HeaderBlockSchema = new Schema(
  {
    id: { type: String, required: true },
    alignment: { type: String, enum: ["left", "center", "right"], default: "left" },
    widgets: { type: [HeaderWidgetSchema], default: [] },
  },
  { _id: false }
);

const HeaderRowSchema = new Schema(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    fixed: { type: Boolean, default: false },
    backgroundColor: { type: String },
    textColor: { type: String },
    height: { type: Number },
    layout: {
      type: String,
      enum: ["full", "50-50", "33-33-33", "20-60-20", "25-50-25", "30-40-30"],
      default: "full",
    },
    blocks: { type: [HeaderBlockSchema], default: [] },
  },
  { _id: false }
);

const HeaderConfigSchema = new Schema(
  {
    rows: { type: [HeaderRowSchema], default: [] },
  },
  { _id: false }
);

const StorefrontDomainSchema = new Schema(
  {
    domain: { type: String, required: true, trim: true, lowercase: true },
    is_primary: { type: Boolean, default: false },
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
    channel: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    domains: {
      type: [StorefrontDomainSchema],
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
        show_favorites: true,
        show_reminders: true,
      }),
    },
    header_config: {
      type: HeaderConfigSchema,
      default: () => ({ rows: [] }),
    },
    header_config_draft: {
      type: HeaderConfigSchema,
      default: () => ({ rows: [] }),
    },
    footer: {
      type: B2CStorefrontFooterSchema,
      default: () => ({}),
    },
    footer_draft: {
      type: B2CStorefrontFooterSchema,
      default: undefined,
    },
    meta_tags: {
      type: B2CStorefrontMetaTagsSchema,
      default: () => ({}),
    },
    custom_scripts: {
      type: [CustomScriptSchema],
      default: [],
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
B2CStorefrontSchema.index({ channel: 1 }, { unique: true });
B2CStorefrontSchema.index({ "domains.domain": 1 });
B2CStorefrontSchema.index({ status: 1 });

export { B2CStorefrontSchema };
