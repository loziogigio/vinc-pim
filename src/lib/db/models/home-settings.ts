import mongoose, { Schema } from "mongoose";
import type { CompanyBranding, ProductCardStyle, HomeSettings, CDNConfiguration, CDNCredentials, SMTPSettings, HeaderConfig, HeaderRow, HeaderBlock, HeaderWidget, MetaTags } from "@/lib/types/home-settings";

export interface HomeSettingsDocument
  extends Omit<HomeSettings, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// Product card style schema
const ProductCardStyleSchema = new Schema(
  {
    borderWidth: { type: Number, default: 1, min: 0, max: 4 },
    borderColor: { type: String, default: "#EAEEF2" },
    borderStyle: {
      type: String,
      enum: ["solid", "dashed", "dotted", "none"],
      default: "solid"
    },
    shadowSize: {
      type: String,
      enum: ["none", "sm", "md", "lg", "xl", "2xl"],
      default: "none"
    },
    shadowColor: { type: String, default: "rgba(0, 0, 0, 0.1)" },
    borderRadius: {
      type: String,
      enum: ["none", "sm", "md", "lg", "xl", "2xl", "full"],
      default: "md"
    },
    hoverEffect: {
      type: String,
      enum: ["none", "lift", "shadow", "scale", "border", "glow"],
      default: "none"
    },
    hoverScale: { type: Number, default: 1.02, min: 1.0, max: 1.1 },
    hoverShadowSize: {
      type: String,
      enum: ["sm", "md", "lg", "xl", "2xl"],
      default: "lg"
    },
    backgroundColor: { type: String, default: "#ffffff" },
    hoverBackgroundColor: { type: String }
  },
  { _id: false }
);

// Company branding schema
const CompanyBrandingSchema = new Schema(
  {
    title: { type: String, required: true },
    logo: { type: String },
    favicon: { type: String },
    primaryColor: { type: String, default: "#009f7f" },
    secondaryColor: { type: String, default: "#02b290" },
    shopUrl: { type: String },
    websiteUrl: { type: String },
    // Extended theming colors
    accentColor: { type: String },
    textColor: { type: String },
    mutedColor: { type: String },
    backgroundColor: { type: String },
    headerBackgroundColor: { type: String },
    footerBackgroundColor: { type: String },
    footerTextColor: { type: String }
  },
  { _id: false }
);

// CDN configuration schema
const CDNConfigurationSchema = new Schema(
  {
    baseUrl: { type: String },
    description: { type: String },
    enabled: { type: Boolean, default: true }
  },
  { _id: false }
);

// CDN credentials schema for file uploads
const CDNCredentialsSchema = new Schema(
  {
    cdn_url: { type: String },
    bucket_region: { type: String },
    bucket_name: { type: String },
    folder_name: { type: String },
    cdn_key: { type: String },
    cdn_secret: { type: String },
    signed_url_expiry: { type: Number, default: 0 },
    delete_from_cloud: { type: Boolean, default: false }
  },
  { _id: false }
);

// SMTP settings schema for email configuration
const SMTPSettingsSchema = new Schema(
  {
    host: { type: String },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String },
    password: { type: String },
    from: { type: String },
    from_name: { type: String },
    default_to: { type: String }
  },
  { _id: false }
);

// ============================================================================
// SEO Meta Tags Schema
// ============================================================================

// Meta tags schema for SEO configuration
const MetaTagsSchema = new Schema(
  {
    // Basic meta
    title: { type: String },
    description: { type: String },
    keywords: { type: String },
    author: { type: String },
    robots: { type: String },
    canonicalUrl: { type: String },

    // Open Graph
    ogTitle: { type: String },
    ogDescription: { type: String },
    ogImage: { type: String },
    ogSiteName: { type: String },
    ogType: { type: String },

    // Twitter Card
    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image", "app", "player"]
    },
    twitterSite: { type: String },
    twitterCreator: { type: String },
    twitterImage: { type: String },

    // Structured Data
    structuredData: { type: String },

    // Additional meta
    themeColor: { type: String },
    googleSiteVerification: { type: String },
    bingSiteVerification: { type: String }
  },
  { _id: false }
);

// ============================================================================
// Header Builder Schemas
// ============================================================================

// Header widget schema (individual widget)
const HeaderWidgetSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        "logo",
        "search-bar",
        "radio-widget",
        "category-menu",
        "cart",
        "company-info",
        "no-price",
        "favorites",
        "compare",
        "profile",
        "button",
        "spacer",
        "divider"
      ]
    },
    config: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

// Header block schema (contains widgets)
const HeaderBlockSchema = new Schema(
  {
    id: { type: String, required: true },
    alignment: {
      type: String,
      enum: ["left", "center", "right"],
      default: "left"
    },
    widgets: { type: [HeaderWidgetSchema], default: [] }
  },
  { _id: false }
);

// Header row schema (contains blocks)
const HeaderRowSchema = new Schema(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    fixed: { type: Boolean, default: true },
    backgroundColor: { type: String },
    textColor: { type: String },
    height: { type: Number },
    layout: {
      type: String,
      enum: ["full", "50-50", "33-33-33", "20-60-20", "25-50-25", "30-40-30"],
      default: "20-60-20"
    },
    blocks: { type: [HeaderBlockSchema], default: [] }
  },
  { _id: false }
);

// Header config schema (top level)
const HeaderConfigSchema = new Schema(
  {
    rows: { type: [HeaderRowSchema], default: [] }
  },
  { _id: false }
);

// Home settings schema
const HomeSettingsSchema = new Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    branding: {
      type: CompanyBrandingSchema,
      required: true
    },
    defaultCardVariant: {
      type: String,
      enum: ["b2b", "horizontal", "compact", "detailed"],
      default: "b2b"
    },
    cardStyle: {
      type: ProductCardStyleSchema,
      default: () => ({})
    },
    cdn: {
      type: CDNConfigurationSchema
    },
    cdn_credentials: {
      type: CDNCredentialsSchema
    },
    smtp_settings: {
      type: SMTPSettingsSchema
    },
    footerHtml: { type: String },
    footerHtmlDraft: { type: String },
    headerConfig: {
      type: HeaderConfigSchema
    },
    headerConfigDraft: {
      type: HeaderConfigSchema
    },
    meta_tags: {
      type: MetaTagsSchema
    },
    lastModifiedBy: { type: String }
  },
  {
    timestamps: true,
    collection: "b2bhomesettings"
  }
);

export { HomeSettingsSchema };

export const B2BHomeSettingsModel =
  mongoose.models.B2BHomeSettings || mongoose.model<HomeSettingsDocument>("B2BHomeSettings", HomeSettingsSchema);
