/**
 * B2B Form Definition Model
 *
 * Stores standalone form definitions for B2B portals.
 * These forms are not tied to any page — they can be managed
 * independently and used for automated submissions (e.g., order_note).
 *
 * Collection: b2bformdefinitions
 */

import { Schema } from "mongoose";
import type { FormBlockConfig } from "@/lib/types/blocks";

// ============================================
// INTERFACE
// ============================================

export interface IB2BFormDefinition {
  _id?: string;
  /** Portal this form belongs to */
  portal_slug: string;
  /** Unique slug within the portal (e.g., "order_note") */
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

const B2BFormDefinitionSchema = new Schema(
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
    collection: "b2bformdefinitions",
  }
);

// ============================================
// INDEXES
// ============================================

B2BFormDefinitionSchema.index({ portal_slug: 1, slug: 1 }, { unique: true });
B2BFormDefinitionSchema.index({ portal_slug: 1, enabled: 1 });

export { B2BFormDefinitionSchema };
