/**
 * Email Component Model
 *
 * Reusable email headers and footers that can be combined with template content.
 * Each template can select which header/footer to use, or use defaults.
 */

import mongoose, { Schema, Document } from "mongoose";

export const EMAIL_COMPONENT_TYPES = ["header", "footer"] as const;
export type EmailComponentType = (typeof EMAIL_COMPONENT_TYPES)[number];

export interface IEmailComponent extends Document {
  component_id: string;
  type: EmailComponentType;
  name: string;
  description?: string;
  html_content: string;
  // Variables that can be used in this component
  variables?: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const EmailComponentSchema = new Schema<IEmailComponent>(
  {
    component_id: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: EMAIL_COMPONENT_TYPES,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    html_content: {
      type: String,
      required: true,
    },
    variables: [String],
    is_default: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes
EmailComponentSchema.index({ type: 1, is_active: 1 });
EmailComponentSchema.index({ type: 1, is_default: 1 });

export const EmailComponentModel =
  mongoose.models.EmailComponent ||
  mongoose.model<IEmailComponent>("EmailComponent", EmailComponentSchema);
