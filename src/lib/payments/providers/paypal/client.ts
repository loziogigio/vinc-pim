/**
 * PayPal Commerce Platform Provider (REST API v2)
 *
 * Implements IPaymentProvider for PayPal Commerce Platform.
 * Supports: OnClick (Orders API → redirect), Recurring (Billing Subscriptions).
 * Split payments: App-level only (PayPal supports partner referrals but not auto-split).
 * MOTO: Not supported (PayPal has no MOTO flow).
 *
 * API Base: https://api-m.paypal.com/v2/ (production)
 *           https://api-m.sandbox.paypal.com/v2/ (sandbox)
 * Auth: OAuth2 client_credentials → Bearer token
 *
 * Credentials are read from the per-tenant PayPal config stored in MongoDB
 * (ITenantPaymentConfig.providers.paypal), NOT from environment variables.
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
// TENANT CONFIG INTERFACE
// ============================================

interface PayPalConfig {
  client_id: string;
  client_secret: string;
  merchant_id?: string;
  webhook_id?: string;
  environment: "sandbox" | "production";
  enabled: boolean;
}

// ============================================
// PAYPAL API CLIENT
// ============================================

// Per-tenant token cache keyed by client_id
const tokenCache = new Map<string, { token: string; expires_at: number }>();

function getBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * Get OAuth2 access token (cached per client_id until expiry).
 */
async function getAccessToken(config: PayPalConfig): Promise<string> {
  const cached = tokenCache.get(config.client_id);
  if (cached && Date.now() < cached.expires_at - 60_000) {
    return cached.token;
  }

  const baseUrl = getBaseUrl(config.environment);
  const auth = Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal auth error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(config.client_id, {
    token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

/**
 * Make an authenticated PayPal API request.
 */
async function paypalRequest(
  config: PayPalConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "PayPal-Request-Id": `vinc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayPal API error ${response.status}: ${errorBody}`);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return {};
  }

  return response.json();
}

/**
 * Cast ProviderTenantConfig to PayPalConfig with validation.
 */
function asPayPalConfig(tenantConfig: ProviderTenantConfig): PayPalConfig {
  const config = tenantConfig as PayPalConfig;
  if (!config.client_id || !config.client_secret) {
    throw new Error("PayPal client_id and client_secret are required");
  }
  return config;
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const paypalProvider: IPaymentProvider = {
  name: "paypal",

  // Capabilities
  supportsMoto: false,
  supportsOnClick: true,
  supportsRecurring: true,
  supportsAutomaticSplit: false,

  // ============================================
  // OnClick Payment (Orders API v2 → redirect)
  // ============================================
  async createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    const config = asPayPalConfig(tenantConfig);

    if (!config.enabled) {
      return { success: false, error: "PayPal not enabled for this merchant" };
    }

    try {
      const purchaseUnit: Record<string, unknown> = {
        reference_id: params.metadata?.payment_number || params.order_id,
        amount: {
          currency_code: params.currency || "EUR",
          value: params.amount.toFixed(2),
        },
        description: params.metadata?.description || `Order ${params.order_id}`,
      };

      // Add payee only if merchant_id is configured
      if (config.merchant_id) {
        purchaseUnit.payee = { merchant_id: config.merchant_id };
      }

      const result = await paypalRequest(config, "POST", "/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          return_url: params.return_url || params.metadata?.return_url,
          cancel_url: params.cancel_url || params.metadata?.cancel_url,
          user_action: "PAY_NOW",
          brand_name: params.metadata?.brand_name || "VINC Commerce",
        },
      });

      const order = result as {
        id?: string;
        status?: string;
        links?: Array<{ rel: string; href: string }>;
      };

      const approveLink = order.links?.find((l) => l.rel === "approve");

      return {
        success: true,
        provider_payment_id: order.id || params.order_id,
        redirect_url: approveLink?.href,
        status: order.status || "CREATED",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Capture (after customer approves)
  // ============================================
  async capturePayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    _amount?: number
  ): Promise<PaymentResult> {
    const config = asPayPalConfig(tenantConfig);

    try {
      const result = await paypalRequest(
        config,
        "POST",
        `/v2/checkout/orders/${providerPaymentId}/capture`,
        {}
      );

      const order = result as {
        id?: string;
        status?: string;
        purchase_units?: Array<{
          payments?: {
            captures?: Array<{ id?: string; status?: string }>;
          };
        }>;
      };

      // Extract capture ID — this is PayPal's "Transaction ID" visible in the dashboard
      const captureId =
        order.purchase_units?.[0]?.payments?.captures?.[0]?.id || undefined;

      return {
        success: order.status === "COMPLETED",
        provider_payment_id: order.id || providerPaymentId,
        provider_capture_id: captureId,
        status: order.status || "unknown",
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
    const config = asPayPalConfig(tenantConfig);

    try {
      // providerPaymentId here should be the capture ID (provider_capture_id)
      const body: Record<string, unknown> = {};
      if (amount) {
        body.amount = {
          currency_code: "EUR",
          value: amount.toFixed(2),
        };
      }

      const result = await paypalRequest(
        config,
        "POST",
        `/v2/payments/captures/${providerPaymentId}/refund`,
        body
      );

      const refund = result as { id?: string; status?: string };
      return {
        success: refund.status === "COMPLETED",
        refund_id: refund.id,
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
    const config = asPayPalConfig(tenantConfig);

    try {
      const result = await paypalRequest(
        config,
        "GET",
        `/v2/checkout/orders/${providerPaymentId}`
      );

      const order = result as { id?: string; status?: string };
      return {
        success: order.status === "COMPLETED",
        provider_payment_id: order.id || providerPaymentId,
        status: order.status || "unknown",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Recurring — Create Contract (Billing Subscription)
  // ============================================
  async createContract(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult> {
    const config = asPayPalConfig(tenantConfig);

    if (!config.enabled) {
      throw new Error("PayPal not enabled for this merchant");
    }

    try {
      // Create a billing plan first
      const plan = await paypalRequest(config, "POST", "/v1/billing/plans", {
        product_id: params.customer_id, // Should be a PayPal product_id in production
        name: `Recurring Plan - ${params.contract_type}`,
        billing_cycles: [
          {
            frequency: {
              interval_unit: "DAY",
              interval_count: params.frequency_days || 30,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0, // Infinite
            pricing_scheme: {
              fixed_price: {
                value: (params.max_amount || 0).toFixed(2),
                currency_code: "EUR",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      });

      const planResult = plan as { id?: string; status?: string };

      return {
        contract_id: planResult.id || `pp-${Date.now()}`,
        provider_contract_id: planResult.id || "",
        status: planResult.status === "ACTIVE" ? "active" : "pending",
      };
    } catch (error) {
      throw new Error(`Failed to create PayPal plan: ${(error as Error).message}`);
    }
  },

  // ============================================
  // Recurring — Charge (create subscription from plan)
  // ============================================
  async chargeRecurring(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult> {
    const config = asPayPalConfig(tenantConfig);

    try {
      // For PayPal, recurring charges happen automatically via subscriptions.
      // This creates a subscription that PayPal bills automatically.
      const result = await paypalRequest(config, "POST", "/v1/billing/subscriptions", {
        plan_id: providerContractId,
        custom_id: params.order_id,
        application_context: {
          brand_name: "VINC Commerce",
          user_action: "SUBSCRIBE_NOW",
        },
      });

      const subscription = result as {
        id?: string;
        status?: string;
        links?: Array<{ rel: string; href: string }>;
      };

      const approveLink = subscription.links?.find((l) => l.rel === "approve");

      return {
        success: !!subscription.id,
        provider_payment_id: subscription.id || params.order_id,
        redirect_url: approveLink?.href,
        status: subscription.status || "APPROVAL_PENDING",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Cancel Contract (cancel subscription)
  // ============================================
  async cancelContract(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string
  ): Promise<void> {
    const config = asPayPalConfig(tenantConfig);

    await paypalRequest(
      config,
      "POST",
      `/v1/billing/subscriptions/${providerContractId}/cancel`,
      { reason: "Cancelled by merchant" }
    );
  },

  // ============================================
  // Webhooks
  // ============================================

  /**
   * Verify webhook via PayPal's official verify-webhook-signature API.
   *
   * @param payload  Raw webhook body
   * @param signature  JSON string with PayPal transmission headers + tenant config:
   *   { auth_algo, cert_url, transmission_id, transmission_sig, transmission_time,
   *     client_id, client_secret, environment }
   * @param webhookId  Tenant's webhook_id from MongoDB config
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookId: string
  ): Promise<boolean> {
    if (!webhookId) {
      console.warn("[PayPal] No webhook_id configured — cannot verify");
      return false;
    }

    let headers: Record<string, string>;
    try {
      headers = JSON.parse(signature);
    } catch {
      console.warn("[PayPal] Invalid signature format — expected JSON headers");
      return false;
    }

    const { auth_algo, cert_url, transmission_id, transmission_sig, transmission_time } = headers;
    if (!transmission_id || !transmission_sig) {
      console.warn("[PayPal] Missing required transmission headers");
      return false;
    }

    // Build a temporary config to get an access token for the verify call
    const config: PayPalConfig = {
      client_id: headers.client_id || "",
      client_secret: headers.client_secret || "",
      environment: (headers.environment as "sandbox" | "production") || "sandbox",
      enabled: true,
    };

    if (!config.client_id || !config.client_secret) {
      console.warn("[PayPal] Missing client credentials — cannot verify webhook");
      return false;
    }

    try {
      const token = await getAccessToken(config);
      const baseUrl = getBaseUrl(config.environment);

      const verifyBody = {
        auth_algo: auth_algo || "SHA256withRSA",
        cert_url,
        transmission_id,
        transmission_sig,
        transmission_time,
        webhook_id: webhookId,
        webhook_event: JSON.parse(payload),
      };

      const response = await fetch(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(verifyBody),
        }
      );

      if (!response.ok) {
        console.error(`[PayPal] Verify API error ${response.status}: ${await response.text()}`);
        return false;
      }

      const result = (await response.json()) as { verification_status: string };
      const verified = result.verification_status === "SUCCESS";

      if (!verified) {
        console.warn(`[PayPal] Webhook verification failed: ${result.verification_status}`);
      }

      return verified;
    } catch (error) {
      console.error("[PayPal] Webhook verification error:", error);
      return false;
    }
  },

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload);
    return {
      provider: "paypal",
      event_type: event.event_type || "unknown",
      event_id: event.id || "",
      timestamp: new Date(event.create_time || Date.now()),
      data: event.resource || {},
      raw_payload: payload,
    };
  },

  // ============================================
  // Fees
  // ============================================
  calculateFees(amount: number, currency: string): ProviderFees {
    // PayPal EU pricing: 2.49% + €0.35 (standard)
    const percentageFee = amount * 0.0249;
    const fixedFee = currency.toUpperCase() === "EUR" ? 0.35 : 0.49;
    const totalFee = Math.round((percentageFee + fixedFee) * 100) / 100;

    return {
      fixed_fee: fixedFee,
      percentage_fee: Math.round(percentageFee * 100) / 100,
      total_fee: totalFee,
      currency,
    };
  },
};
