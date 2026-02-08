/**
 * Payment Type Definitions
 *
 * Shared types for the payment system.
 * Constants and enums are re-exported from @/lib/constants/payment.
 */

// Re-export from constants
export type {
  PaymentProvider,
  PaymentType,
  TransactionStatus,
  PaymentMethod,
  CommissionStatus,
  SubscriptionStatus,
  ContractType,
  ProviderCapabilities,
} from "@/lib/constants/payment";

export {
  PAYMENT_PROVIDERS,
  PAYMENT_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  COMMISSION_STATUSES,
  SUBSCRIPTION_STATUSES,
  CONTRACT_TYPES,
  PROVIDER_CAPABILITIES,
  PAYMENT_DEFAULTS,
} from "@/lib/constants/payment";

// ============================================
// PROVIDER DATA (embedded in IPaymentRecord)
// ============================================

export interface IProviderData {
  provider_payment_id?: string;
  provider_contract_id?: string;
  payment_type?: "onclick" | "moto" | "recurrent";
  three_ds_status?: string;
}

// ============================================
// PAYMENT TRANSACTION
// ============================================

export interface IPaymentTransaction {
  transaction_id: string;
  tenant_id: string;
  order_id?: string;
  provider: string;
  provider_payment_id: string;
  payment_type: "onclick" | "moto" | "recurrent";

  // Amounts
  gross_amount: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;

  // Status
  status: string;
  method?: string;

  // Customer
  customer_id?: string;
  customer_email?: string;

  // Error handling
  failure_reason?: string;
  failure_code?: string;

  // Audit trail
  events: IPaymentEvent[];

  // Idempotency
  idempotency_key?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface IPaymentEvent {
  event_type: string;
  status: string;
  timestamp: Date;
  provider_event_id?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// TENANT PAYMENT CONFIG
// ============================================

export interface ITenantPaymentConfig {
  tenant_id: string;
  commission_rate: number;

  // Provider configurations
  providers: {
    stripe?: IStripeConfig;
    mangopay?: IMangopayConfig;
    paypal?: IPayPalConfig;
    nexi?: INexiConfig;
    axerve?: IAxerveConfig;
    satispay?: ISatispayConfig;
    scalapay?: IScalapayConfig;
  };

  default_provider?: string;
  enabled_methods: string[];

  created_at: Date;
  updated_at: Date;
}

export interface IStripeConfig {
  account_id: string;
  account_status: "pending" | "active" | "restricted";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarded_at?: Date;
}

export interface IMangopayConfig {
  user_id: string;
  wallet_id: string;
  bank_account_id?: string;
  kyc_level: "LIGHT" | "REGULAR";
  status: "pending" | "active" | "blocked";
  onboarded_at?: Date;
}

export interface IPayPalConfig {
  merchant_id: string;
  enabled: boolean;
}

export interface INexiConfig {
  api_key: string;
  terminal_id?: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  moto_enabled: boolean;
  recurring_enabled: boolean;
}

export interface IAxerveConfig {
  shop_login: string;
  api_key: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  moto_profile: boolean;
  recurring_enabled: boolean;
}

export interface ISatispayConfig {
  key_id: string;
  enabled: boolean;
}

export interface IScalapayConfig {
  api_key: string;
  environment: "sandbox" | "production";
  enabled: boolean;
}

// ============================================
// RECURRING CONTRACT
// ============================================

export interface IRecurringContract {
  contract_id: string;
  tenant_id: string;
  customer_id: string;
  provider: string;
  provider_contract_id: string;
  contract_type: "scheduled" | "unscheduled";

  // Token/card info (masked)
  token_id?: string;
  card_last_four?: string;
  card_brand?: string;
  card_expiry?: string;

  // Schedule (for scheduled contracts)
  frequency_days?: number;
  max_amount?: number;
  next_charge_date?: Date;

  // Status
  status: "active" | "paused" | "cancelled" | "expired";
  expiry_date?: Date;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
}

// ============================================
// PLATFORM COMMISSION
// ============================================

export interface IPlatformCommission {
  transaction_id: string;
  tenant_id: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
  status: "pending" | "collected" | "paid_out";
  collected_at?: Date;
  paid_out_at?: Date;
  created_at: Date;
}

// ============================================
// SERVICE RESULTS
// ============================================

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  provider_payment_id?: string;
  status?: string;
  redirect_url?: string;
  client_secret?: string;
  error?: string;
  error_code?: string;
}

export interface CommissionBreakdown {
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
}

// ============================================
// SERVICE INPUT PARAMS
// ============================================

export interface CreatePaymentParams {
  order_id: string;
  amount: number;
  currency: string;
  method?: string;
  customer_id?: string;
  customer_email?: string;
  return_url?: string;
  metadata?: Record<string, string>;
  idempotency_key?: string;
}

export interface MotoPaymentParams {
  order_id: string;
  amount: number;
  currency: string;
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  cvv?: string;
  description?: string;
  idempotency_key?: string;
}

export interface ContractParams {
  customer_id: string;
  contract_type: "scheduled" | "unscheduled";
  frequency_days?: number;
  expiry_date?: Date;
  max_amount?: number;
}

export interface RecurringChargeParams {
  amount: number;
  currency: string;
  order_id: string;
  description?: string;
  idempotency_key?: string;
}

export interface ContractResult {
  contract_id: string;
  provider_contract_id: string;
  token_id?: string;
  status: "active" | "pending";
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  amount?: number;
  error?: string;
}

// ============================================
// WEBHOOK
// ============================================

export interface WebhookEvent {
  provider: string;
  event_type: string;
  event_id: string;
  timestamp: Date;
  data: Record<string, unknown>;
  raw_payload: string;
}

// ============================================
// PROVIDER FEES
// ============================================

export interface ProviderFees {
  fixed_fee: number;
  percentage_fee: number;
  total_fee: number;
  currency: string;
}
