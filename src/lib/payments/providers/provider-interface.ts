/**
 * Payment Provider Interface (Strategy Pattern)
 *
 * All payment providers implement this interface.
 * Optional methods are gated by capability flags.
 */

import type {
  PaymentResult,
  RefundResult,
  MotoPaymentParams,
  ContractParams,
  ContractResult,
  RecurringChargeParams,
  CreatePaymentParams,
  WebhookEvent,
  ProviderFees,
} from "@/lib/types/payment";

export interface IPaymentProvider {
  /** Provider identifier (matches PAYMENT_PROVIDERS constant) */
  readonly name: string;

  // ============================================
  // CAPABILITY FLAGS
  // ============================================

  readonly supportsMoto: boolean;
  readonly supportsOnClick: boolean;
  readonly supportsRecurring: boolean;
  readonly supportsAutomaticSplit: boolean;

  // ============================================
  // CORE OPERATIONS (OnClick — standard e-commerce)
  // ============================================

  /**
   * Create a payment (OnClick flow).
   * Returns redirect URL or client secret for frontend completion.
   */
  createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult>;

  /**
   * Capture a previously authorized payment.
   */
  capturePayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<PaymentResult>;

  /**
   * Refund a payment (full or partial).
   */
  refundPayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<RefundResult>;

  /**
   * Get payment status from provider.
   */
  getPaymentStatus(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string
  ): Promise<PaymentResult>;

  // ============================================
  // MOTO OPERATIONS (operator-initiated)
  // ============================================

  /**
   * Create a MOTO payment (card-not-present, no 3DS).
   * Only available when supportsMoto = true.
   */
  createMotoPayment?(
    tenantConfig: ProviderTenantConfig,
    params: MotoPaymentParams
  ): Promise<PaymentResult>;

  // ============================================
  // RECURRING OPERATIONS (tokenized card, MIT)
  // ============================================

  /**
   * Create a recurring contract (first CIT with 3DS).
   * Only available when supportsRecurring = true.
   */
  createContract?(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult>;

  /**
   * Charge a recurring contract (MIT, no 3DS).
   */
  chargeRecurring?(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult>;

  /**
   * Cancel a recurring contract.
   */
  cancelContract?(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string
  ): Promise<void>;

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Verify webhook signature from provider.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Parse raw webhook payload into normalized event.
   */
  parseWebhookEvent(payload: string): WebhookEvent;

  // ============================================
  // FEES
  // ============================================

  /**
   * Calculate estimated provider fees for an amount.
   */
  calculateFees?(amount: number, currency: string): ProviderFees;
}

/**
 * Provider-specific tenant configuration.
 * Extracted from ITenantPaymentConfig.providers[providerName].
 */
export interface ProviderTenantConfig {
  [key: string]: unknown;
}
