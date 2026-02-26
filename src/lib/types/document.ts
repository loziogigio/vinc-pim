/**
 * Document Type Definitions
 *
 * Types for the Documents app: quotations, invoices, proformas, credit notes.
 * Standalone document system independent from orders.
 */

// Re-export from constants
export type {
  DocumentType,
  DocumentStatus,
  DocumentHistoryAction,
  PaymentTerms,
  PageSize,
  PageOrientation,
} from "@/lib/constants/document";

export {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_PREFIXES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TRANSITIONS,
  DOCUMENT_HISTORY_ACTIONS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  DEFAULT_NUMBERING_FORMATS,
  DEFAULT_NUMBER_PADDING,
  canTransitionDocument,
  getAllowedDocumentTransitions,
  canEditDocument,
  isTerminalDocumentStatus,
} from "@/lib/constants/document";

// ============================================
// LINE ITEM
// ============================================

export interface DocumentLineItem {
  line_number: number; // 10, 20, 30...
  description: string;
  sku?: string;
  entity_code?: string;
  quantity: number;
  quantity_unit?: string; // "pz", "kg", etc.
  unit_price: number;
  vat_rate: number; // 22, 10, 4, 0
  discount_percent?: number;
  line_net: number; // quantity * unit_price * (1 - discount%)
  line_vat: number; // line_net * vat_rate%
  line_total: number; // line_net + line_vat
}

// ============================================
// TOTALS
// ============================================

export interface VatBreakdownEntry {
  rate: number;
  taxable: number;
  vat: number;
}

export interface DocumentTotals {
  subtotal_net: number;
  total_discount: number;
  total_vat: number;
  total: number;
  vat_breakdown: VatBreakdownEntry[];
}

// ============================================
// COMPANY INFO (issuer snapshot)
// ============================================

export interface DocumentCompanyInfo {
  legal_name: string;
  address_line1?: string;
  address_line2?: string;
  vat_number?: string;
  fiscal_code?: string;
  phone?: string;
  email?: string;
  pec_email?: string;
  sdi_code?: string;
  logo_url?: string;
}

// ============================================
// CUSTOMER INFO (recipient snapshot)
// ============================================

export interface DocumentCustomerInfo {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  vat_number?: string;
  fiscal_code?: string;
  pec_email?: string;
  sdi_code?: string;
  billing_address?: {
    street_address: string;
    street_address_2?: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
  };
}

// ============================================
// HISTORY ENTRY
// ============================================

export interface DocumentHistoryEntry {
  action: string;
  performed_by: string;
  performed_by_name?: string;
  performed_at: Date;
  details?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

// ============================================
// DOCUMENT
// ============================================

export interface Document {
  document_id: string;
  document_type: import("@/lib/constants/document").DocumentType;
  document_number?: string;
  document_number_raw?: number;
  year: number;
  status: import("@/lib/constants/document").DocumentStatus;
  tenant_id: string;

  company: DocumentCompanyInfo;
  customer: DocumentCustomerInfo;

  items: DocumentLineItem[];
  totals: DocumentTotals;

  country_code?: string;
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
// NUMBERING CONFIG
// ============================================

export interface NumberingConfig {
  document_type: import("@/lib/constants/document").DocumentType;
  format: string; // "INV-{YEAR}-{NUMBER}"
  padding: number;
  reset_yearly: boolean;
}

// ============================================
// TEMPLATE
// ============================================

export interface DocumentTemplate {
  template_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  document_type: string; // "all" or specific DocumentType
  html_template: string;
  css_styles?: string;
  page_size: import("@/lib/constants/document").PageSize;
  orientation: import("@/lib/constants/document").PageOrientation;
  margins: { top: number; right: number; bottom: number; left: number };
  is_default: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// DOCUMENT SETTINGS
// ============================================

export interface DocumentSettings {
  settings_id: string;
  tenant_id: string;
  numbering: NumberingConfig[];
  default_currency: string;
  default_payment_terms?: string;
  default_notes?: string;
  default_validity_days: number;
  country_code?: string;
  document_language?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateDocumentRequest {
  document_type: import("@/lib/constants/document").DocumentType;
  customer_id: string;
  country_code?: string;
  document_language?: string;
  items?: DocumentLineItem[];
  currency?: string;
  payment_terms?: string;
  payment_method?: string;
  due_date?: string; // ISO date
  validity_days?: number;
  notes?: string;
  internal_notes?: string;
  footer_text?: string;
  template_id?: string;
}

export interface UpdateDocumentRequest {
  customer_id?: string;
  items?: DocumentLineItem[];
  currency?: string;
  payment_terms?: string;
  payment_method?: string;
  due_date?: string;
  validity_days?: number;
  notes?: string;
  internal_notes?: string;
  footer_text?: string;
  template_id?: string;
}

export interface CreateFromOrderRequest {
  order_id: string;
  document_type: import("@/lib/constants/document").DocumentType;
}

export interface SendDocumentRequest {
  recipient_email: string;
  subject?: string;
  message?: string;
}

export interface DocumentListResponse {
  success: true;
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DocumentResponse {
  success: true;
  document: Document;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate line item totals
 */
export function calculateDocumentLineTotals(
  quantity: number,
  unit_price: number,
  vat_rate: number,
  discount_percent?: number
): { line_net: number; line_vat: number; line_total: number } {
  const discount = discount_percent ? discount_percent / 100 : 0;
  const line_net = quantity * unit_price * (1 - discount);
  const line_vat = line_net * (vat_rate / 100);
  const line_total = line_net + line_vat;

  return {
    line_net: Math.round(line_net * 100) / 100,
    line_vat: Math.round(line_vat * 100) / 100,
    line_total: Math.round(line_total * 100) / 100,
  };
}

/**
 * Calculate document totals from line items (with VAT breakdown by rate)
 */
export function calculateDocumentTotals(items: DocumentLineItem[]): DocumentTotals {
  const vatMap = new Map<number, { taxable: number; vat: number }>();

  let subtotal_net = 0;
  let total_discount = 0;
  let total_vat = 0;

  for (const item of items) {
    subtotal_net += item.line_net;
    total_vat += item.line_vat;

    if (item.discount_percent && item.discount_percent > 0) {
      const gross = item.quantity * item.unit_price;
      total_discount += gross - item.line_net;
    }

    // Accumulate VAT breakdown by rate
    const existing = vatMap.get(item.vat_rate) || { taxable: 0, vat: 0 };
    existing.taxable += item.line_net;
    existing.vat += item.line_vat;
    vatMap.set(item.vat_rate, existing);
  }

  const vat_breakdown: VatBreakdownEntry[] = Array.from(vatMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { taxable, vat }]) => ({
      rate,
      taxable: Math.round(taxable * 100) / 100,
      vat: Math.round(vat * 100) / 100,
    }));

  return {
    subtotal_net: Math.round(subtotal_net * 100) / 100,
    total_discount: Math.round(total_discount * 100) / 100,
    total_vat: Math.round(total_vat * 100) / 100,
    total: Math.round((subtotal_net + total_vat) * 100) / 100,
    vat_breakdown,
  };
}

/**
 * Get next line number (increment by 10)
 */
export function getNextDocumentLineNumber(items: DocumentLineItem[]): number {
  if (!items || items.length === 0) return 10;
  const maxLine = Math.max(...items.map((i) => i.line_number));
  return maxLine + 10;
}
