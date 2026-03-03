/**
 * Manual Payment Provider
 *
 * No-op provider for offline payment methods (bank_transfer, cash_on_delivery).
 * Creates a PaymentTransaction record — no gateway interaction.
 * The merchant manually confirms payment when funds arrive.
 */

import type { IPaymentProvider, ProviderTenantConfig } from "../provider-interface";
import type {
  CreatePaymentParams,
  PaymentResult,
  RefundResult,
  WebhookEvent,
} from "@/lib/types/payment";

export const manualProvider: IPaymentProvider = {
  name: "manual",

  supportsMoto: false,
  supportsOnClick: false,
  supportsRecurring: false,
  supportsAutomaticSplit: false,

  async createPayment(
    _tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    return {
      success: true,
      provider_payment_id: `manual_${params.order_id}_${Date.now()}`,
      status: "processing",
    };
  },

  async capturePayment(
    _tenantConfig: ProviderTenantConfig,
    _providerPaymentId: string
  ): Promise<PaymentResult> {
    return { success: true, status: "completed" };
  },

  async refundPayment(
    _tenantConfig: ProviderTenantConfig,
    _providerPaymentId: string,
    _amount?: number
  ): Promise<RefundResult> {
    return { success: true, refund_id: `manual_refund_${Date.now()}` };
  },

  async getPaymentStatus(
    _tenantConfig: ProviderTenantConfig,
    _providerPaymentId: string
  ): Promise<PaymentResult> {
    return { success: true, status: "processing" };
  },

  verifyWebhookSignature(): boolean {
    return false;
  },

  parseWebhookEvent(_payload: string): WebhookEvent {
    throw new Error("Manual provider does not support webhooks");
  },
};
