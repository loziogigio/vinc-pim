/**
 * Country Configuration Types
 *
 * Interfaces for the pluggable country compliance system.
 * Add a new country by implementing CountryConfig.
 */

import type { DocumentType, DocumentStatus, PaymentTerms } from "@/lib/constants/document";

export type SupportedLanguage = "it" | "en" | "sk";

/** Fiscal ID field definition for a country */
export interface FiscalIdFieldConfig {
  field_key: string;
  required_business: boolean;
  required_private: boolean;
  pattern: RegExp;
  format_hint: string;
}

/** VAT rate definition */
export interface VatRateConfig {
  rate: number;
  label_key: string;
}

/** All translatable labels for a single language */
export interface CountryLabels {
  document_types: Record<DocumentType, string>;
  document_statuses: Record<DocumentStatus, string>;
  payment_terms: Record<PaymentTerms, string>;
  template: {
    recipient: string;
    vat_number: string;
    fiscal_code: string;
    pec_email: string;
    sdi_code: string;
    description: string;
    quantity: string;
    unit_price: string;
    discount: string;
    vat: string;
    total: string;
    subtotal: string;
    notes: string;
    date: string;
    due_date: string;
    payment_terms_label: string;
    document_label: string;
    dear_customer: string;
    registered_office: string;
    page: string;
    draft: string;
    total_discount: string;
    payment_conditions: string;
    ico: string;
    dic: string;
    ic_dph: string;
    amount_due: string;
  };
  email: {
    dear_customer: string;
    attached_document: string;
    pdf_format: string;
    regards: string;
  };
  locale: string;
}

/** Full country configuration */
export interface CountryConfig {
  code: string;
  name: string;
  primary_language: SupportedLanguage;
  supported_languages: SupportedLanguage[];
  default_currency: string;
  vat_rates: VatRateConfig[];
  fiscal_id_fields: FiscalIdFieldConfig[];
  labels: Partial<Record<SupportedLanguage, CountryLabels>>;
  einvoicing_ready: boolean;
}
