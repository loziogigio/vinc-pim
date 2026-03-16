/**
 * Form Definition Model
 *
 * Stores standalone form definitions for B2C storefronts.
 * These forms are not tied to any page — they can be managed
 * independently and used for automated submissions (e.g., order_note).
 *
 * Collection: formdefinitions
 */

import { Schema } from "mongoose";
import type { FormBlockConfig } from "@/lib/types/blocks";

// ============================================
// INTERFACE
// ============================================

export interface IFormDefinition {
  _id?: string;
  /** Storefront this form belongs to */
  storefront_slug: string;
  /** Unique slug within the storefront (e.g., "order_note") */
  slug: string;
  /** Display name */
  name: string;
  /** Form configuration — reuses the page builder FormBlockConfig type */
  config: FormBlockConfig;
  /** Email addresses to receive submission notifications */
  notification_emails: string[];
  /** Whether the submitter also receives a copy of the notification */
  send_submitter_copy: boolean;
  /** System forms (e.g., order_note) cannot be deleted */
  is_system: boolean;
  /** Whether this form definition is active */
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const FormDefinitionSchema = new Schema(
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
        /^[a-z0-9_-]+$/,
        "Slug must be lowercase alphanumeric with dashes or underscores",
      ],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: () => ({ variant: "form", fields: [] }),
    },
    notification_emails: {
      type: [String],
      default: [],
    },
    send_submitter_copy: {
      type: Boolean,
      default: false,
    },
    is_system: {
      type: Boolean,
      default: false,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "formdefinitions",
  }
);

// ============================================
// INDEXES
// ============================================

FormDefinitionSchema.index({ storefront_slug: 1, slug: 1 }, { unique: true });
FormDefinitionSchema.index({ storefront_slug: 1, enabled: 1 });

export { FormDefinitionSchema };
