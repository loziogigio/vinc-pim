/**
 * B2B Portal Model
 *
 * Root document for a B2B portal. Structurally mirrors B2CStorefront
 * so the admin UI can reuse the same section components
 * (branding, header, footer, SEO, scripts).
 *
 * Stored in the tenant database (vinc-{tenant-id}).
 * Each tenant has one "default" portal (multi-portal is future work).
 */

import { Schema } from "mongoose";
import {
  B2CStorefrontBrandingSchema,
  HeaderConfigSchema,
  B2CStorefrontFooterSchema,
  B2CStorefrontMetaTagsSchema,
  CustomScriptSchema,
  B2CStorefrontSettingsSchema,
  B2CStorefrontDomainSchema,
} from "./b2c-storefront";
import { B2B_PORTAL_STATUSES } from "@/lib/types/b2b-portal";

export const B2BPortalSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    channel: { type: String, required: true, trim: true },
    domains: { type: [B2CStorefrontDomainSchema], default: [] },
    status: {
      type: String,
      enum: B2B_PORTAL_STATUSES,
      default: "active",
    },
    branding: {
      type: B2CStorefrontBrandingSchema,
      default: () => ({}),
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
    collection: "b2bportals",
  },
);

B2BPortalSchema.index({ slug: 1 }, { unique: true });
B2BPortalSchema.index({ "domains.domain": 1 });
B2BPortalSchema.index({ status: 1 });
