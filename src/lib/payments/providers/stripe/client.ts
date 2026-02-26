/**
 * Stripe Provider
 *
 * Implements IPaymentProvider for Stripe Connect.
 * Supports: OnClick (Elements/Checkout), MOTO (card-not-present), Recurring (Billing).
 * Split payments: Native via Connect transfers.
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

// Lazy-loaded Stripe SDK
let stripe: ReturnType<typeof createStripeClient> | null = null;

function getStripe() {
  if (!stripe) {
    stripe = createStripeClient();
  }
  return stripe;
}

function createStripeClient() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-12-18.acacia",
  }) as import("stripe").default;
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const stripeProvider: IPaymentProvider = {
  name: "stripe",

  // Capabilities
  supportsMoto: true,
  supportsOnClick: true,
  supportsRecurring: true,
  supportsAutomaticSplit: true,

  // ============================================
  // OnClick Payment (Stripe PaymentIntent)
  // ============================================
  async createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    const client = getStripe();
    const config = tenantConfig as { account_id: string; charges_enabled: boolean };

    if (!config.charges_enabled) {
      return { success: false, error: "Stripe account not ready for charges" };
    }

    try {
      const paymentIntent = await client.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Stripe uses cents
        currency: (params.currency || "EUR").toLowerCase(),
        transfer_data: {
          destination: config.account_id,
        },
        metadata: {
          order_id: params.order_id,
          customer_id: params.customer_id || "",
          ...params.metadata,
        },
        ...(params.idempotency_key && {}),
      }, {
        ...(params.idempotency_key && { idempotencyKey: params.idempotency_key }),
      });

      return {
        success: true,
        provider_payment_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret || undefined,
        status: paymentIntent.status,
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      return {
        success: false,
        error: err.message || "Stripe payment failed",
        error_code: err.code,
      };
    }
  },

  // ============================================
  // Capture
  // ============================================
  async capturePayment(
    _tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<PaymentResult> {
    const client = getStripe();

    try {
      const paymentIntent = await client.paymentIntents.capture(
        providerPaymentId,
        amount ? { amount_to_capture: Math.round(amount * 100) } : {}
      );

      return {
        success: true,
        provider_payment_id: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const err = error as { message?: string };
      return { success: false, error: err.message || "Capture failed" };
    }
  },

  // ============================================
  // Refund
  // ============================================
  async refundPayment(
    _tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    const client = getStripe();

    try {
      const refund = await client.refunds.create({
        payment_intent: providerPaymentId,
        ...(amount && { amount: Math.round(amount * 100) }),
      });

      return {
        success: true,
        refund_id: refund.id,
        amount: refund.amount / 100,
      };
    } catch (error) {
      const err = error as { message?: string };
      return { success: false, error: err.message || "Refund failed" };
    }
  },

  // ============================================
  // Get Status
  // ============================================
  async getPaymentStatus(
    _tenantConfig: ProviderTenantConfig,
    providerPaymentId: string
  ): Promise<PaymentResult> {
    const client = getStripe();

    try {
      const paymentIntent = await client.paymentIntents.retrieve(providerPaymentId);
      return {
        success: paymentIntent.status === "succeeded",
        provider_payment_id: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const err = error as { message?: string };
      return { success: false, error: err.message || "Status check failed" };
    }
  },

  // ============================================
  // MOTO Payment (card-not-present, no 3DS)
  // ============================================
  async createMotoPayment(
    tenantConfig: ProviderTenantConfig,
    params: MotoPaymentParams
  ): Promise<PaymentResult> {
    const client = getStripe();
    const config = tenantConfig as { account_id: string };

    try {
      // Create a PaymentMethod with card details
      const paymentMethod = await client.paymentMethods.create({
        type: "card",
        card: {
          number: params.card_number,
          exp_month: parseInt(params.expiry_month),
          exp_year: parseInt(params.expiry_year),
          cvc: params.cvv,
        },
      });

      // Create and confirm PaymentIntent with MOTO exemption
      const paymentIntent = await client.paymentIntents.create({
        amount: Math.round(params.amount * 100),
        currency: (params.currency || "EUR").toLowerCase(),
        payment_method: paymentMethod.id,
        confirm: true,
        payment_method_options: {
          card: {
            moto: true, // MOTO exemption — no 3DS
          },
        },
        transfer_data: {
          destination: config.account_id,
        },
        metadata: {
          order_id: params.order_id,
          payment_type: "moto",
        },
      }, {
        ...(params.idempotency_key && { idempotencyKey: params.idempotency_key }),
      });

      return {
        success: paymentIntent.status === "succeeded",
        provider_payment_id: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      return {
        success: false,
        error: err.message || "Stripe MOTO payment failed",
        error_code: err.code,
      };
    }
  },

  // ============================================
  // Recurring — Create Contract (first CIT with 3DS)
  // ============================================
  async createContract(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult> {
    const client = getStripe();

    try {
      // Create a SetupIntent for future use
      const setupIntent = await client.setupIntents.create({
        customer: params.customer_id,
        usage: params.contract_type === "scheduled" ? "off_session" : "off_session",
        metadata: {
          contract_type: params.contract_type,
          ...(params.frequency_days && { frequency_days: params.frequency_days.toString() }),
        },
      });

      return {
        contract_id: setupIntent.id,
        provider_contract_id: setupIntent.id,
        status: "pending",
      };
    } catch (error) {
      throw new Error(`Failed to create Stripe contract: ${(error as Error).message}`);
    }
  },

  // ============================================
  // Recurring — Charge (MIT, off-session)
  // ============================================
  async chargeRecurring(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult> {
    const client = getStripe();
    const config = tenantConfig as { account_id: string };

    try {
      // Retrieve the SetupIntent to get the PaymentMethod
      const setupIntent = await client.setupIntents.retrieve(providerContractId);
      const paymentMethodId = setupIntent.payment_method as string;

      if (!paymentMethodId) {
        return { success: false, error: "No payment method on contract" };
      }

      const paymentIntent = await client.paymentIntents.create({
        amount: Math.round(params.amount * 100),
        currency: (params.currency || "EUR").toLowerCase(),
        customer: setupIntent.customer as string,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        transfer_data: {
          destination: config.account_id,
        },
        metadata: {
          order_id: params.order_id,
          payment_type: "recurrent",
          contract_id: providerContractId,
        },
      }, {
        ...(params.idempotency_key && { idempotencyKey: params.idempotency_key }),
      });

      return {
        success: paymentIntent.status === "succeeded",
        provider_payment_id: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      return {
        success: false,
        error: err.message || "Recurring charge failed",
        error_code: err.code,
      };
    }
  },

  // ============================================
  // Cancel Contract
  // ============================================
  async cancelContract(
    _tenantConfig: ProviderTenantConfig,
    providerContractId: string
  ): Promise<void> {
    const client = getStripe();
    await client.setupIntents.cancel(providerContractId);
  },

  // ============================================
  // Webhooks
  // ============================================
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const client = getStripe();
      client.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch {
      return false;
    }
  },

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload);
    return {
      provider: "stripe",
      event_type: event.type,
      event_id: event.id,
      timestamp: new Date(event.created * 1000),
      data: event.data?.object || {},
      raw_payload: payload,
    };
  },

  // ============================================
  // Fees
  // ============================================
  calculateFees(amount: number, currency: string): ProviderFees {
    // Stripe EU pricing: 1.4% + €0.25 (EEA cards)
    const percentageFee = amount * 0.014;
    const fixedFee = currency.toUpperCase() === "EUR" ? 0.25 : 0.30;
    const totalFee = Math.round((percentageFee + fixedFee) * 100) / 100;

    return {
      fixed_fee: fixedFee,
      percentage_fee: Math.round(percentageFee * 100) / 100,
      total_fee: totalFee,
      currency,
    };
  },
};
