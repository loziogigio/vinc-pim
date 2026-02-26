/**
 * Payment Constants
 *
 * Single source of truth for payment-related enumerations.
 * Covers: transaction statuses, payment methods, providers, payment types,
 * commission, and subscription statuses.
 */

// ============================================
// PAYMENT PROVIDERS
// ============================================

export const PAYMENT_PROVIDERS = [
  "stripe",
  "mangopay",
  "paypal",
  "nexi",
  "axerve",
  "satispay",
  "scalapay",
  "manual",
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  mangopay: "Mangopay",
  paypal: "PayPal",
  nexi: "Nexi XPay",
  axerve: "Axerve (Fabrick)",
  satispay: "Satispay",
  scalapay: "Scalapay",
  manual: "Manuale",
};

// ============================================
// PAYMENT TYPES (MOTO, OnClick, Recurrent)
// ============================================

export const PAYMENT_TYPES = ["onclick", "moto", "recurrent"] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  onclick: "OnClick (E-Commerce)",
  moto: "MOTO (Telefono/Mail)",
  recurrent: "Ricorrente",
};

export const PAYMENT_TYPE_DESCRIPTIONS: Record<PaymentType, string> = {
  onclick: "Standard e-commerce — customer enters card on checkout page, 3DS required",
  moto: "Mail Order / Telephone Order — operator enters card data server-side, 3DS exempt",
  recurrent: "Recurring/subscription — tokenized card, Merchant-Initiated Transaction",
};

// ============================================
// TRANSACTION STATUSES
// ============================================

export const TRANSACTION_STATUSES = [
  "pending",
  "processing",
  "authorized",
  "captured",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "partial_refund",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "In Attesa",
  processing: "In Elaborazione",
  authorized: "Autorizzato",
  captured: "Catturato",
  completed: "Completato",
  failed: "Fallito",
  cancelled: "Annullato",
  refunded: "Rimborsato",
  partial_refund: "Rimborso Parziale",
};

// ============================================
// PAYMENT METHODS
// ============================================

export const PAYMENT_METHODS = [
  "credit_card",
  "debit_card",
  "bank_transfer",
  "paypal",
  "satispay",
  "klarna",
  "scalapay",
  "apple_pay",
  "google_pay",
  "sepa_direct_debit",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit_card: "Carta di Credito",
  debit_card: "Carta di Debito",
  bank_transfer: "Bonifico Bancario",
  paypal: "PayPal",
  satispay: "Satispay",
  klarna: "Klarna",
  scalapay: "Scalapay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  sepa_direct_debit: "Addebito Diretto SEPA",
};

// ============================================
// COMMISSION STATUSES
// ============================================

export const COMMISSION_STATUSES = [
  "pending",
  "collected",
  "paid_out",
] as const;

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "In Attesa",
  collected: "Incassato",
  paid_out: "Pagato",
};

// ============================================
// SUBSCRIPTION STATUSES
// ============================================

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
  "unpaid",
  "expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Periodo di Prova",
  active: "Attivo",
  past_due: "Scaduto",
  paused: "In Pausa",
  cancelled: "Cancellato",
  unpaid: "Non Pagato",
  expired: "Scaduto",
};

// ============================================
// RECURRING CONTRACT TYPES
// ============================================

export const CONTRACT_TYPES = ["scheduled", "unscheduled"] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  scheduled: "Programmato (importo fisso, frequenza fissa)",
  unscheduled: "Non programmato (importo variabile, su richiesta)",
};

// ============================================
// PROVIDER CAPABILITIES
// ============================================

export interface ProviderCapabilities {
  supportsMoto: boolean;
  supportsOnClick: boolean;
  supportsRecurring: boolean;
  supportsAutomaticSplit: boolean;
}

export const PROVIDER_CAPABILITIES: Record<PaymentProvider, ProviderCapabilities> = {
  stripe: {
    supportsMoto: true,
    supportsOnClick: true,
    supportsRecurring: true,
    supportsAutomaticSplit: true,
  },
  mangopay: {
    supportsMoto: false,
    supportsOnClick: true,
    supportsRecurring: true,
    supportsAutomaticSplit: true,
  },
  paypal: {
    supportsMoto: false,
    supportsOnClick: true,
    supportsRecurring: true,
    supportsAutomaticSplit: false,
  },
  nexi: {
    supportsMoto: true,
    supportsOnClick: true,
    supportsRecurring: true,
    supportsAutomaticSplit: false,
  },
  axerve: {
    supportsMoto: true,
    supportsOnClick: true,
    supportsRecurring: true,
    supportsAutomaticSplit: false,
  },
  satispay: {
    supportsMoto: false,
    supportsOnClick: true,
    supportsRecurring: false,
    supportsAutomaticSplit: false,
  },
  scalapay: {
    supportsMoto: false,
    supportsOnClick: true,
    supportsRecurring: false,
    supportsAutomaticSplit: false,
  },
  manual: {
    supportsMoto: false,
    supportsOnClick: false,
    supportsRecurring: false,
    supportsAutomaticSplit: false,
  },
};

// ============================================
// DEFAULT VALUES
// ============================================

export const PAYMENT_DEFAULTS = {
  /** Default platform commission rate (2.5%) */
  COMMISSION_RATE: 0.025,
  /** Idempotency key TTL in seconds (24 hours) */
  IDEMPOTENCY_TTL: 86400,
  /** Default currency */
  CURRENCY: "EUR",
  /** Max retry attempts for webhook processing */
  WEBHOOK_MAX_RETRIES: 5,
  /** Subscription trial period in days */
  TRIAL_DAYS: 14,
} as const;
