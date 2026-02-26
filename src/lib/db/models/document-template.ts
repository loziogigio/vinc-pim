/**
 * Document Template Model
 *
 * HTML templates for rendering documents as PDFs.
 * Collection: "documenttemplates"
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  DOCUMENT_TYPES,
  PAGE_SIZES,
  PAGE_ORIENTATIONS,
  HEADER_STYLES,
  LOGO_POSITIONS,
} from "@/lib/constants/document";
import type {
  DocumentType,
  PageSize,
  PageOrientation,
  TemplateHeaderConfig,
  TemplateFooterConfig,
} from "@/lib/constants/document";

export interface IDocumentTemplate extends Document {
  template_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  document_type: string; // "all" or specific DocumentType
  html_template: string;
  css_styles?: string;
  page_size: PageSize;
  orientation: PageOrientation;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  header_config: TemplateHeaderConfig;
  footer_config: TemplateFooterConfig;
  is_default: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

const MarginsSchema = new Schema(
  {
    top: { type: Number, default: 15 },
    right: { type: Number, default: 15 },
    bottom: { type: Number, default: 15 },
    left: { type: Number, default: 15 },
  },
  { _id: false },
);

const HeaderConfigSchema = new Schema(
  {
    show_logo: { type: Boolean, default: true },
    logo_position: { type: String, enum: LOGO_POSITIONS, default: "left" },
    show_company_info: { type: Boolean, default: true },
    style: { type: String, enum: HEADER_STYLES, default: "standard" },
  },
  { _id: false },
);

const FooterConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    show_notes: { type: Boolean, default: true },
    show_page_numbers: { type: Boolean, default: true },
    custom_text: String,
  },
  { _id: false },
);

const DocumentTemplateSchema = new Schema<IDocumentTemplate>(
  {
    template_id: { type: String, required: true, unique: true, index: true },
    tenant_id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: String,
    document_type: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) =>
          v === "all" ||
          (DOCUMENT_TYPES as readonly string[]).includes(v),
        message: "Must be 'all' or a valid document type",
      },
    },
    html_template: { type: String, required: true },
    css_styles: String,
    page_size: { type: String, enum: PAGE_SIZES, default: "A4" },
    orientation: { type: String, enum: PAGE_ORIENTATIONS, default: "portrait" },
    margins: { type: MarginsSchema, default: () => ({}) },
    header_config: { type: HeaderConfigSchema, default: () => ({}) },
    footer_config: { type: FooterConfigSchema, default: () => ({}) },
    is_default: { type: Boolean, default: false },
    is_system: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "documenttemplates",
  },
);

DocumentTemplateSchema.index({ tenant_id: 1, document_type: 1 });

export { DocumentTemplateSchema };
