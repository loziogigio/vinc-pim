/**
 * Document Constants
 *
 * Single source of truth for document-related enumerations and status transitions.
 * Covers: quotations, invoices, proformas, credit notes.
 */

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOCUMENT_TYPES = [
  "quotation",
  "proforma",
  "invoice",
  "credit_note",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quotation: "Preventivo",
  proforma: "Proforma",
  invoice: "Fattura",
  credit_note: "Nota di Credito",
};

export const DOCUMENT_TYPE_PREFIXES: Record<DocumentType, string> = {
  quotation: "Q",
  proforma: "PF",
  invoice: "INV",
  credit_note: "NC",
};

// ============================================
// DOCUMENT STATUSES
// ============================================

export const DOCUMENT_STATUSES = [
  "draft",
  "finalized",
  "sent",
  "paid",
  "voided",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Bozza",
  finalized: "Finalizzato",
  sent: "Inviato",
  paid: "Pagato",
  voided: "Annullato",
};

// ============================================
// STATUS TRANSITIONS
// ============================================

export const DOCUMENT_STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["finalized"],
  finalized: ["sent", "voided"],
  sent: ["paid", "voided"],
  paid: ["voided"],
  voided: [],
};

/**
 * Check if a document status transition is allowed.
 */
export function canTransitionDocument(from: DocumentStatus, to: DocumentStatus): boolean {
  return DOCUMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get allowed transitions for a given document status.
 */
export function getAllowedDocumentTransitions(from: DocumentStatus): DocumentStatus[] {
  return DOCUMENT_STATUS_TRANSITIONS[from] ?? [];
}

/**
 * Check if a document can be edited (only drafts).
 */
export function canEditDocument(status: DocumentStatus): boolean {
  return status === "draft";
}

/**
 * Check if a document is in a terminal state.
 */
export function isTerminalDocumentStatus(status: DocumentStatus): boolean {
  return status === "voided";
}

// ============================================
// NUMBERING
// ============================================

export const DEFAULT_NUMBERING_FORMATS: Record<DocumentType, string> = {
  quotation: "Q-{YEAR}-{NUMBER}",
  proforma: "PF-{YEAR}-{NUMBER}",
  invoice: "INV-{YEAR}-{NUMBER}",
  credit_note: "NC-{YEAR}-{NUMBER}",
};

export const DEFAULT_NUMBER_PADDING = 5;

// ============================================
// HISTORY ACTIONS
// ============================================

export const DOCUMENT_HISTORY_ACTIONS = [
  "created",
  "updated",
  "finalized",
  "sent",
  "paid",
  "voided",
  "duplicated",
  "pdf_generated",
  "number_assigned",
] as const;

export type DocumentHistoryAction = (typeof DOCUMENT_HISTORY_ACTIONS)[number];

// ============================================
// PAYMENT TERMS
// ============================================

export const PAYMENT_TERMS = [
  "immediate",
  "NET15",
  "NET30",
  "NET60",
  "NET90",
  "COD",
] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  immediate: "Pagamento Immediato",
  NET15: "30 giorni",
  NET30: "30 giorni",
  NET60: "60 giorni",
  NET90: "90 giorni",
  COD: "Contrassegno",
};

// ============================================
// PAGE SIZES
// ============================================

export const PAGE_SIZES = ["A4", "letter"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const PAGE_ORIENTATIONS = ["portrait", "landscape"] as const;
export type PageOrientation = (typeof PAGE_ORIENTATIONS)[number];

// ============================================
// TEMPLATE HEADER / FOOTER CONFIG
// ============================================

export const HEADER_STYLES = ["standard", "banner", "minimal", "centered"] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number];

export const HEADER_STYLE_LABELS: Record<HeaderStyle, string> = {
  standard: "Standard",
  banner: "Banner",
  minimal: "Minimale",
  centered: "Centrato",
};

export const LOGO_POSITIONS = ["left", "center", "right"] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  left: "Sinistra",
  center: "Centro",
  right: "Destra",
};

export interface TemplateHeaderConfig {
  show_logo: boolean;
  logo_position: LogoPosition;
  show_company_info: boolean;
  style: HeaderStyle;
}

export interface TemplateFooterConfig {
  enabled: boolean;
  show_notes: boolean;
  show_page_numbers: boolean;
  custom_text?: string;
}

export const DEFAULT_HEADER_CONFIG: TemplateHeaderConfig = {
  show_logo: true,
  logo_position: "left",
  show_company_info: true,
  style: "standard",
};

export const DEFAULT_FOOTER_CONFIG: TemplateFooterConfig = {
  enabled: true,
  show_notes: true,
  show_page_numbers: true,
};

// ============================================
// TEMPLATE NAMES (for system templates)
// ============================================

export const SYSTEM_TEMPLATE_NAMES = {
  classico: "Classico",
  moderno: "Moderno",
  minimale: "Minimale",
  formale: "Formale",
} as const;

export type SystemTemplateName = keyof typeof SYSTEM_TEMPLATE_NAMES;

// ============================================
// COUNTRY-AWARE LABEL HELPERS
// ============================================

import { getLabels } from "@/lib/constants/countries";
import type { CountryLabels } from "@/lib/constants/countries/types";

/**
 * Get document type labels for a country/language combo.
 * Defaults to IT/primary language (backward compatible).
 */
export function getDocumentTypeLabels(
  countryCode?: string,
  language?: string
): Record<DocumentType, string> {
  const labels = getLabels(countryCode || "IT", language);
  return labels.document_types;
}

/**
 * Get document status labels for a country/language combo.
 * Defaults to IT/primary language (backward compatible).
 */
export function getDocumentStatusLabels(
  countryCode?: string,
  language?: string
): Record<DocumentStatus, string> {
  const labels = getLabels(countryCode || "IT", language);
  return labels.document_statuses;
}

/**
 * Get all template labels for a country/language combo.
 */
export function getTemplateLabels(
  countryCode?: string,
  language?: string
): CountryLabels {
  return getLabels(countryCode || "IT", language);
}
