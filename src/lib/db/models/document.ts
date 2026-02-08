/**
 * Document Model
 *
 * Standalone document collection for quotations, invoices, proformas, and credit notes.
 * Collection: "documents"
 */

import mongoose, { Schema, Document } from "mongoose";
import type {
  DocumentCompanyInfo,
  DocumentCustomerInfo,
  DocumentLineItem,
  DocumentTotals,
  DocumentHistoryEntry,
  VatBreakdownEntry,
} from "@/lib/types/document";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES } from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";

// ============================================
// INTERFACES
// ============================================

export interface IDocument extends Document {
  document_id: string;
  document_type: DocumentType;
  document_number?: string;
  document_number_raw?: number;
  year: number;
  status: DocumentStatus;
  tenant_id: string;

  company: DocumentCompanyInfo;
  customer: DocumentCustomerInfo;
  items: DocumentLineItem[];
  totals: DocumentTotals;

  country_code: string;
  document_language?: string;

  currency: string;
  payment_terms?: string;
  payment_method?: string;
  due_date?: Date;
  validity_days?: number;

  notes?: string;
  internal_notes?: string;
  footer_text?: string;

  template_id?: string;
  source_order_id?: string;
  source_document_id?: string;
  related_documents?: string[];

  pdf_url?: string;
  pdf_generated_at?: Date;
  last_sent_at?: Date;
  sent_to?: string[];
  send_count?: number;

  history: DocumentHistoryEntry[];

  duplicated_from?: string;
  duplicated_at?: Date;

  created_at: Date;
  updated_at: Date;
  finalized_at?: Date;
  voided_at?: Date;
}

// ============================================
// SUB-SCHEMAS
// ============================================

const DocumentCompanyInfoSchema = new Schema(
  {
    legal_name: { type: String, required: true },
    address_line1: String,
    address_line2: String,
    vat_number: String,
    fiscal_code: String,
    phone: String,
    email: String,
    pec_email: String,
    sdi_code: String,
    logo_url: String,
  },
  { _id: false }
);

const BillingAddressSchema = new Schema(
  {
    street_address: { type: String, required: true },
    street_address_2: String,
    city: { type: String, required: true },
    province: { type: String, required: true },
    postal_code: { type: String, required: true },
    country: { type: String, default: "IT" },
  },
  { _id: false }
);

const DocumentCustomerInfoSchema = new Schema(
  {
    customer_id: { type: String, required: true },
    company_name: String,
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    vat_number: String,
    fiscal_code: String,
    pec_email: String,
    sdi_code: String,
    billing_address: BillingAddressSchema,
  },
  { _id: false }
);

const DocumentLineItemSchema = new Schema(
  {
    line_number: { type: Number, required: true },
    description: { type: String, required: true },
    sku: String,
    entity_code: String,
    quantity: { type: Number, required: true },
    quantity_unit: String,
    unit_price: { type: Number, required: true },
    vat_rate: { type: Number, required: true },
    discount_percent: Number,
    line_net: { type: Number, required: true },
    line_vat: { type: Number, required: true },
    line_total: { type: Number, required: true },
  },
  { _id: false }
);

const VatBreakdownSchema = new Schema(
  {
    rate: { type: Number, required: true },
    taxable: { type: Number, required: true },
    vat: { type: Number, required: true },
  },
  { _id: false }
);

const DocumentTotalsSchema = new Schema(
  {
    subtotal_net: { type: Number, default: 0 },
    total_discount: { type: Number, default: 0 },
    total_vat: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    vat_breakdown: { type: [VatBreakdownSchema], default: [] },
  },
  { _id: false }
);

const DocumentHistoryEntrySchema = new Schema(
  {
    action: { type: String, required: true },
    performed_by: { type: String, required: true },
    performed_by_name: String,
    performed_at: { type: Date, default: Date.now },
    details: String,
    changes: Schema.Types.Mixed,
  },
  { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================

const DocumentSchema = new Schema<IDocument>(
  {
    document_id: { type: String, required: true, unique: true, index: true },
    document_type: { type: String, enum: DOCUMENT_TYPES, required: true },
    document_number: String,
    document_number_raw: Number,
    year: { type: Number, required: true },
    status: { type: String, enum: DOCUMENT_STATUSES, default: "draft" },
    tenant_id: { type: String, required: true, index: true },

    company: { type: DocumentCompanyInfoSchema, required: true },
    customer: { type: DocumentCustomerInfoSchema, required: true },
    items: { type: [DocumentLineItemSchema], default: [] },
    totals: { type: DocumentTotalsSchema, default: () => ({}) },

    country_code: { type: String, default: "IT" },
    document_language: String,

    currency: { type: String, default: "EUR" },
    payment_terms: String,
    payment_method: String,
    due_date: Date,
    validity_days: Number,

    notes: String,
    internal_notes: String,
    footer_text: String,

    template_id: String,
    source_order_id: String,
    source_document_id: String,
    related_documents: [String],

    pdf_url: String,
    pdf_generated_at: Date,
    last_sent_at: Date,
    sent_to: [String],
    send_count: { type: Number, default: 0 },

    history: { type: [DocumentHistoryEntrySchema], default: [] },

    duplicated_from: String,
    duplicated_at: Date,

    finalized_at: Date,
    voided_at: Date,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "documents",
  }
);

// Compound indexes
DocumentSchema.index({ tenant_id: 1, document_type: 1, status: 1, created_at: -1 });
DocumentSchema.index(
  { tenant_id: 1, document_number: 1 },
  { unique: true, partialFilterExpression: { document_number: { $exists: true, $ne: null } } }
);
DocumentSchema.index({ tenant_id: 1, "customer.customer_id": 1 });
DocumentSchema.index({ source_order_id: 1 });
DocumentSchema.index({ source_document_id: 1 });

export { DocumentSchema };
