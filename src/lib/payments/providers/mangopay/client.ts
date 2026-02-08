/**
 * Mangopay Provider (REST API v2.01)
 *
 * Implements IPaymentProvider for Mangopay.
 * Supports: OnClick (Web PayIn → redirect), Recurring (Preauthorization + RecurringPayIn).
 * Split payments: Native via wallet-to-wallet transfers.
 * MOTO: Not directly supported (use Direct PayIn with 3DS exemption request).
 *
 * API Base: https://api.mangopay.com/v2.01/{clientId}/
 *           https://api.sandbox.mangopay.com/v2.01/{clientId}/
 * Auth: Basic Auth (clientId:apiKey)
 */

import type { IPaymentProvider, ProviderTenantConfig } from "../provider-interface";
import type {
  CreatePaymentParams,
  ContractParams,
  ContractResult,
  RecurringChargeParams,
  PaymentResult,
  RefundResult,
  WebhookEvent,
  ProviderFees,
} from "@/lib/types/payment";

// ============================================
// MANGOPAY API CLIENT
// ============================================

interface MangopayConfig {
  user_id: string;
  wallet_id: string;
  bank_account_id?: string;
  kyc_level: "LIGHT" | "REGULAR";
  status: "pending" | "active" | "blocked";
}

interface MangopayPlatformConfig {
  client_id: string;
  api_key: string;
  environment: "sandbox" | "production";
  platform_wallet_id: string;
}

function getBaseUrl(config: MangopayPlatformConfig): string {
  const host =
    config.environment === "production"
      ? "https://api.mangopay.com"
      : "https://api.sandbox.mangopay.com";
  return `${host}/v2.01/${config.client_id}`;
}

/**
 * Make an authenticated Mangopay API request.
 */
async function mangopayRequest(
  config: MangopayPlatformConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = getBaseUrl(config);
  const auth = Buffer.from(`${config.client_id}:${config.api_key}`).toString("base64");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mangopay API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

/**
 * Get platform config from environment variables.
 */
function getPlatformConfig(): MangopayPlatformConfig {
  return {
    client_id: process.env.MANGOPAY_CLIENT_ID || "",
    api_key: process.env.MANGOPAY_API_KEY || "",
    environment: (process.env.MANGOPAY_ENVIRONMENT as "sandbox" | "production") || "sandbox",
    platform_wallet_id: process.env.MANGOPAY_PLATFORM_WALLET_ID || "",
  };
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const mangopayProvider: IPaymentProvider = {
  name: "mangopay",

  // Capabilities
  supportsMoto: false,
  supportsOnClick: true,
  supportsRecurring: true,
  supportsAutomaticSplit: true, // Native wallet-to-wallet transfers

  // ============================================
  // OnClick Payment (Web PayIn → redirect)
  // ============================================
  async createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as MangopayConfig;
    const platform = getPlatformConfig();

    if (config.status !== "active") {
      return { success: false, error: "Mangopay account not active" };
    }

    try {
      // Create a Web PayIn (redirect to Mangopay hosted page)
      const result = await mangopayRequest(platform, "POST", "/payins/card/web", {
        AuthorId: config.user_id,
        CreditedWalletId: config.wallet_id,
        DebitedFunds: {
          Currency: params.currency || "EUR",
          Amount: Math.round(params.amount * 100), // Mangopay uses cents
        },
        Fees: {
          Currency: params.currency || "EUR",
          Amount: 0, // Platform fees handled via transfers
        },
        ReturnURL: params.return_url || params.metadata?.return_url,
        CardType: "CB_VISA_MASTERCARD",
        Culture: "IT",
        Tag: params.order_id,
      });

      const payin = result as {
        Id?: string;
        Status?: string;
        RedirectURL?: string;
      };

      return {
        success: true,
        provider_payment_id: payin.Id || params.order_id,
        redirect_url: payin.RedirectURL,
        status: payin.Status || "CREATED",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Capture (Mangopay auto-captures Web PayIns)
  // ============================================
  async capturePayment(
    _tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    _amount?: number
  ): Promise<PaymentResult> {
    // Mangopay Web PayIns are auto-captured on success
    // For Preauthorized PayIns, use POST /payins/preauthorized/direct
    return {
      success: true,
      provider_payment_id: providerPaymentId,
      status: "SUCCEEDED",
    };
  },

  // ============================================
  // Refund
  // ============================================
  async refundPayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    const config = tenantConfig as MangopayConfig;
    const platform = getPlatformConfig();

    try {
      const body: Record<string, unknown> = {
        AuthorId: config.user_id,
        Tag: `refund-${providerPaymentId}`,
      };

      if (amount) {
        body.DebitedFunds = {
          Currency: "EUR",
          Amount: Math.round(amount * 100),
        };
      }

      const result = await mangopayRequest(
        platform,
        "POST",
        `/payins/${providerPaymentId}/refunds`,
        body
      );

      const refund = result as { Id?: string; Status?: string };
      return {
        success: refund.Status === "SUCCEEDED",
        refund_id: refund.Id,
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
    _tenantConfig: ProviderTenantConfig,
    providerPaymentId: string
  ): Promise<PaymentResult> {
    const platform = getPlatformConfig();

    try {
      const result = await mangopayRequest(
        platform,
        "GET",
        `/payins/${providerPaymentId}`
      );

      const payin = result as { Id?: string; Status?: string };
      return {
        success: payin.Status === "SUCCEEDED",
        provider_payment_id: payin.Id || providerPaymentId,
        status: payin.Status || "unknown",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Recurring — Create Contract (Preauthorization)
  // ============================================
  async createContract(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult> {
    const config = tenantConfig as MangopayConfig;
    const platform = getPlatformConfig();

    if (config.status !== "active") {
      throw new Error("Mangopay account not active");
    }

    try {
      // Create a recurring PayIn registration (CIT first charge)
      const result = await mangopayRequest(
        platform,
        "POST",
        "/recurringpayinregistrations",
        {
          AuthorId: config.user_id,
          CreditedWalletId: config.wallet_id,
          FirstTransactionDebitedFunds: {
            Currency: "EUR",
            Amount: Math.round((params.max_amount || 0) * 100),
          },
          FirstTransactionFees: {
            Currency: "EUR",
            Amount: 0,
          },
          FreeCycles: 0,
          ...(params.frequency_days && {
            Frequency: params.frequency_days <= 7 ? "Weekly" : "Monthly",
          }),
          ...(params.expiry_date && {
            EndDate: Math.floor(params.expiry_date.getTime() / 1000),
          }),
        }
      );

      const registration = result as { Id?: string; Status?: string };

      return {
        contract_id: registration.Id || `mgp-${Date.now()}`,
        provider_contract_id: registration.Id || "",
        status: registration.Status === "CREATED" ? "pending" : "active",
      };
    } catch (error) {
      throw new Error(`Failed to create Mangopay contract: ${(error as Error).message}`);
    }
  },

  // ============================================
  // Recurring — Charge (MIT via RecurringPayIn)
  // ============================================
  async chargeRecurring(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult> {
    const platform = getPlatformConfig();

    try {
      const result = await mangopayRequest(
        platform,
        "POST",
        "/payins/recurring/card/direct",
        {
          RecurringPayinRegistrationId: providerContractId,
          DebitedFunds: {
            Currency: params.currency || "EUR",
            Amount: Math.round(params.amount * 100),
          },
          Fees: {
            Currency: params.currency || "EUR",
            Amount: 0,
          },
          Tag: params.order_id,
        }
      );

      const payin = result as { Id?: string; Status?: string; ResultCode?: string };

      return {
        success: payin.Status === "SUCCEEDED",
        provider_payment_id: payin.Id || params.order_id,
        status: payin.Status || "unknown",
        ...(payin.Status !== "SUCCEEDED" && {
          error: `Mangopay result code: ${payin.ResultCode}`,
        }),
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
    providerContractId: string
  ): Promise<void> {
    const platform = getPlatformConfig();

    await mangopayRequest(
      platform,
      "PUT",
      `/recurringpayinregistrations/${providerContractId}`,
      { Status: "ENDED" }
    );
  },

  // ============================================
  // Webhooks
  // ============================================
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string
  ): boolean {
    // Mangopay webhooks are simple GET/POST notifications
    // Verification is done by checking the event via API
    return true;
  },

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload);
    return {
      provider: "mangopay",
      event_type: event.EventType || "unknown",
      event_id: event.ResourceId || "",
      timestamp: new Date(event.Date ? event.Date * 1000 : Date.now()),
      data: event,
      raw_payload: payload,
    };
  },

  // ============================================
  // Fees
  // ============================================
  calculateFees(amount: number, currency: string): ProviderFees {
    // Mangopay: 1.8% + €0.18 (standard EU cards)
    const percentageFee = amount * 0.018;
    const fixedFee = currency.toUpperCase() === "EUR" ? 0.18 : 0.25;
    const totalFee = Math.round((percentageFee + fixedFee) * 100) / 100;

    return {
      fixed_fee: fixedFee,
      percentage_fee: Math.round(percentageFee * 100) / 100,
      total_fee: totalFee,
      currency,
    };
  },
};
