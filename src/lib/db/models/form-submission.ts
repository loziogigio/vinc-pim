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

export interface IFormSubmission {
  _id?: string;
  /** Storefront where the form was submitted */
  storefront_slug: string;
  /** Page containing the form */
  page_slug: string;
  /** Block ID of the form within the page */
  form_block_id: string;
  /** Submitted field values keyed by field ID */
  data: Record<string, unknown>;
  /** Email extracted from submission (if any email field) */
  submitter_email?: string;
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
      required: true,
      trim: true,
      lowercase: true,
    },
    form_block_id: {
      type: String,
      required: true,
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
FormSubmissionSchema.index({ created_at: -1 });

export { FormSubmissionSchema };
