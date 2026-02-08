/**
 * Nexi XPay Provider (REST API)
 *
 * Implements IPaymentProvider for Nexi XPay.
 * Supports: OnClick (HPP/XPay Build), MOTO (POST /orders/moto), Recurring (contracts + MIT).
 * Split payments: App-level only (no native support).
 *
 * API Base: https://xpay.nexigroup.com/api/phoenix-0.0/psp/api/v1/
 * Auth: X-API-KEY header per terminal + Correlation-Id
 */

import type { IPaymentProvider, ProviderTenantConfig } from "../provider-interface";
import type {
  CreatePaymentParams,
  MotoPaymentParams,
  ContractParams,
  ContractResult,
  RecurringChargeParams,
  PaymentResult,
  RefundResult,
  WebhookEvent,
  ProviderFees,
} from "@/lib/types/payment";

// ============================================
// NEXI API CLIENT
// ============================================

interface NexiConfig {
  api_key: string;
  terminal_id?: string;
  environment: "sandbox" | "production";
  moto_enabled: boolean;
  recurring_enabled: boolean;
}

function getBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://xpay.nexigroup.com/api/phoenix-0.0/psp/api/v1"
    : "https://stg-ta.nexigroup.com/api/phoenix-0.0/psp/api/v1";
}

async function nexiRequest(
  config: NexiConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = getBaseUrl(config.environment);
  const correlationId = `vinc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.api_key,
      "Correlation-Id": correlationId,
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Nexi API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const nexiProvider: IPaymentProvider = {
  name: "nexi",

  // Capabilities
  supportsMoto: true,
  supportsOnClick: true,
  supportsRecurring: true,
  supportsAutomaticSplit: false,

  // ============================================
  // OnClick Payment (HPP redirect)
  // ============================================
  async createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as NexiConfig;

    try {
      const result = await nexiRequest(config, "POST", "/orders/hpp", {
        order: {
          orderId: params.order_id,
          amount: Math.round(params.amount * 100).toString(),
          currency: params.currency || "EUR",
          description: params.metadata?.description || `Order ${params.order_id}`,
        },
        paymentSession: {
          actionType: "PAY",
          amount: Math.round(params.amount * 100).toString(),
          language: "ITA",
          resultUrl: params.return_url,
          cancelUrl: params.return_url,
          notificationUrl: params.metadata?.webhook_url,
        },
      });

      const hostedPage = result as { hostedPage?: string; securityToken?: string };

      return {
        success: true,
        provider_payment_id: params.order_id,
        redirect_url: hostedPage.hostedPage,
        status: "processing",
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },

  // ============================================
  // Capture
  // ============================================
  async capturePayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<PaymentResult> {
    const config = tenantConfig as NexiConfig;

    try {
      await nexiRequest(config, "POST", `/operations/${providerPaymentId}/captures`, {
        amount: amount ? Math.round(amount * 100).toString() : undefined,
        currency: "EUR",
      });

      return {
        success: true,
        provider_payment_id: providerPaymentId,
        status: "captured",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Refund
  // ============================================
  async refundPayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    const config = tenantConfig as NexiConfig;

    try {
      const result = await nexiRequest(
        config,
        "POST",
        `/operations/${providerPaymentId}/refunds`,
        {
          amount: amount ? Math.round(amount * 100).toString() : undefined,
          currency: "EUR",
        }
      );

      return {
        success: true,
        refund_id: (result as { operationId?: string }).operationId,
        amount,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Get Status
  // ============================================
  async getPaymentStatus(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string
  ): Promise<PaymentResult> {
    const config = tenantConfig as NexiConfig;

    try {
      const result = await nexiRequest(
        config,
        "GET",
        `/orders/${providerPaymentId}/status`
      );

      const status = result as { orderStatus?: { lastOperationType?: string } };
      return {
        success: true,
        provider_payment_id: providerPaymentId,
        status: status.orderStatus?.lastOperationType || "unknown",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // MOTO Payment (POST /orders/moto)
  // ============================================
  async createMotoPayment(
    tenantConfig: ProviderTenantConfig,
    params: MotoPaymentParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as NexiConfig;

    if (!config.moto_enabled) {
      return { success: false, error: "MOTO not enabled for this terminal" };
    }

    try {
      const result = await nexiRequest(config, "POST", "/orders/moto", {
        order: {
          orderId: params.order_id,
          amount: Math.round(params.amount * 100).toString(),
          currency: params.currency || "EUR",
          description: params.description || `MOTO Order ${params.order_id}`,
        },
        card: {
          pan: params.card_number,
          expiryDate: `${params.expiry_month}${params.expiry_year}`,
          ...(params.cvv && { cvv: params.cvv }),
        },
      });

      const payment = result as { operation?: { operationResult?: string; operationId?: string } };

      return {
        success: payment.operation?.operationResult === "AUTHORIZED",
        provider_payment_id: payment.operation?.operationId || params.order_id,
        status: payment.operation?.operationResult || "unknown",
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },

  // ============================================
  // Recurring — Create Contract
  // ============================================
  async createContract(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult> {
    const config = tenantConfig as NexiConfig;

    if (!config.recurring_enabled) {
      throw new Error("Recurring not enabled for this terminal");
    }

    // Nexi contracts are created via a CIT payment with contractId
    // The actual contract creation happens during the first HPP payment
    const contractId = `nxi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      contract_id: contractId,
      provider_contract_id: contractId,
      status: "pending", // Becomes active after first CIT payment
    };
  },

  // ============================================
  // Recurring — Charge (MIT)
  // ============================================
  async chargeRecurring(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as NexiConfig;

    try {
      const result = await nexiRequest(config, "POST", "/orders/mit", {
        order: {
          orderId: params.order_id,
          amount: Math.round(params.amount * 100).toString(),
          currency: params.currency || "EUR",
          description: params.description || `Recurring ${params.order_id}`,
        },
        contractId: providerContractId,
        captureType: "EXPLICIT",
      });

      const payment = result as { operation?: { operationResult?: string; operationId?: string } };

      return {
        success: payment.operation?.operationResult === "AUTHORIZED",
        provider_payment_id: payment.operation?.operationId || params.order_id,
        status: payment.operation?.operationResult || "unknown",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Cancel Contract
  // ============================================
  async cancelContract(
    _tenantConfig: ProviderTenantConfig,
    _providerContractId: string
  ): Promise<void> {
    // Nexi contracts don't have an explicit cancel API
    // They expire based on card expiry or when the merchant stops using them
  },

  // ============================================
  // Webhooks
  // ============================================
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string
  ): boolean {
    // Nexi uses server-to-server notification with MAC verification
    // TODO: Implement MAC verification when webhook signing is configured
    return true;
  },

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload);
    return {
      provider: "nexi",
      event_type: event.operationType || "unknown",
      event_id: event.operationId || "",
      timestamp: new Date(),
      data: event,
      raw_payload: payload,
    };
  },

  // ============================================
  // Fees
  // ============================================
  calculateFees(amount: number, currency: string): ProviderFees {
    // Nexi: ~1.5% estimated (varies by contract)
    const percentageFee = amount * 0.015;
    const totalFee = Math.round(percentageFee * 100) / 100;

    return {
      fixed_fee: 0,
      percentage_fee: totalFee,
      total_fee: totalFee,
      currency,
    };
  },
};
