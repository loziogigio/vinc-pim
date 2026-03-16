/**
 * Form Submission Model
 *
 * Stores form submissions from B2C storefront pages.
 * Each submission links to a storefront, page, and specific form block.
 *
 * Collection: formsubmissions
 */

import { Schema } from "mongoose";

// ============================================
// INTERFACE
// ============================================

export type FormSubmissionType = "page_form" | "standalone";

export interface IFormSubmission {
  _id?: string;
  /** Storefront where the form was submitted */
  storefront_slug: string;
  /** Page containing the form (required for page_form, empty for standalone) */
  page_slug?: string;
  /** Block ID of the form within the page (for page_form type) */
  form_block_id?: string;
  /** Type of form submission */
  form_type: FormSubmissionType;
  /** Reference to a standalone form definition slug */
  form_definition_slug?: string;
  /** Reference to an order (for order_note submissions) */
  order_id?: string;
  /** Submitted field values keyed by field ID */
  data: Record<string, unknown>;
  /** Email extracted from submission (if any email field) */
  submitter_email?: string;
  /** Whether the submission has been seen/opened by admin */
  seen: boolean;
  created_at: Date;
}

// ============================================
// SCHEMA
// ============================================

const FormSubmissionSchema = new Schema(
  {
    storefront_slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    page_slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    form_block_id: {
      type: String,
      trim: true,
    },
    form_type: {
      type: String,
      enum: ["page_form", "standalone"],
      default: "page_form",
    },
    form_definition_slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    order_id: {
      type: String,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    submitter_email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "formsubmissions",
  }
);

// ============================================
// INDEXES
// ============================================

FormSubmissionSchema.index({ storefront_slug: 1, page_slug: 1 });
FormSubmissionSchema.index({ storefront_slug: 1, form_type: 1 });
FormSubmissionSchema.index({ created_at: -1 });

export { FormSubmissionSchema };
