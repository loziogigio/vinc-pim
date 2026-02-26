/**
 * Document Settings Model
 *
 * Per-tenant settings for document numbering, defaults, etc.
 * Collection: "documentsettings"
 */

import mongoose, { Schema, Document } from "mongoose";
import { DOCUMENT_TYPES, DEFAULT_NUMBERING_FORMATS, DEFAULT_NUMBER_PADDING } from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";

export interface INumberingConfig {
  document_type: DocumentType;
  format: string;
  padding: number;
  reset_yearly: boolean;
}

export interface IDocumentSettings extends Document {
  settings_id: string;
  tenant_id: string;
  numbering: INumberingConfig[];
  default_currency: string;
  default_payment_terms?: string;
  default_notes?: string;
  default_validity_days: number;
  country_code: string;
  document_language?: string;
  created_at: Date;
  updated_at: Date;
}

const NumberingConfigSchema = new Schema(
  {
    document_type: { type: String, enum: DOCUMENT_TYPES, required: true },
    format: { type: String, required: true },
    padding: { type: Number, default: DEFAULT_NUMBER_PADDING },
    reset_yearly: { type: Boolean, default: true },
  },
  { _id: false }
);

const DocumentSettingsSchema = new Schema<IDocumentSettings>(
  {
    settings_id: { type: String, required: true, default: "global" },
    tenant_id: { type: String, required: true, index: true },
    numbering: {
      type: [NumberingConfigSchema],
      default: () =>
        DOCUMENT_TYPES.map((type) => ({
          document_type: type,
          format: DEFAULT_NUMBERING_FORMATS[type],
          padding: DEFAULT_NUMBER_PADDING,
          reset_yearly: true,
        })),
    },
    default_currency: { type: String, default: "EUR" },
    default_payment_terms: String,
    default_notes: String,
    default_validity_days: { type: Number, default: 30 },
    country_code: { type: String, default: "IT" },
    document_language: String,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "documentsettings",
  }
);

DocumentSettingsSchema.index({ tenant_id: 1, settings_id: 1 }, { unique: true });

export { DocumentSettingsSchema };
