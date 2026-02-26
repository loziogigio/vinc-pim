/**
 * Payment Service
 *
 * Core payment orchestration with idempotency, commission calculation,
 * and provider delegation. Thin orchestrator following separation of concerns.
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { getModelRegistry } from "@/lib/db/model-registry";
import { calculateCommission, getTenantCommissionRate } from "./commission.service";
import { getProvider } from "./providers/provider-registry";
import type {
  CreatePaymentParams,
  MotoPaymentParams,
  RecurringChargeParams,
  PaymentResult,
  RefundResult,
  ContractParams,
  ContractResult,
} from "@/lib/types/payment";
import type { IPaymentTransaction, IPaymentEvent } from "@/lib/db/models/payment-transaction";

// ============================================
// TYPES
// ============================================

interface ProcessPaymentOptions {
  tenantId: string;
  providerName: string;
  paymentType: "onclick" | "moto" | "recurrent";
}

// ============================================
// CREATE PAYMENT (OnClick)
// ============================================

/**
 * Process an OnClick payment through the specified provider.
 */
export async function processPayment(
  tenantDb: mongoose.Connection,
  options: ProcessPaymentOptions,
  params: CreatePaymentParams
): Promise<PaymentResult> {
  const { tenantId, providerName, paymentType } = options;

  // 1. Check idempotency
  if (params.idempotency_key) {
    const existing = await findByIdempotencyKey(tenantDb, params.idempotency_key);
    if (existing) {
      return {
        success: existing.status === "completed",
        transaction_id: existing.transaction_id,
        provider_payment_id: existing.provider_payment_id,
        status: existing.status,
      };
    }
  }

  // 2. Get provider
  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, error: `Unknown provider: ${providerName}` };
  }

  // 3. Get tenant config for this provider
  const tenantConfig = await getProviderConfig(tenantDb, tenantId, providerName);
  if (!tenantConfig) {
    return { success: false, error: `Provider ${providerName} not configured for tenant` };
  }

  // 4. Calculate commission
  const commissionRate = await getTenantCommissionRate(tenantDb, tenantId);
  const commission = calculateCommission(params.amount, commissionRate, params.currency);

  // 5. Create transaction record
  const transactionId = `txn_${nanoid(16)}`;
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const transaction = await PaymentTransaction.create({
    transaction_id: transactionId,
    tenant_id: tenantId,
    order_id: params.order_id,
    provider: providerName,
    provider_payment_id: "", // Set after provider call
    payment_type: paymentType,
    gross_amount: params.amount,
    currency: params.currency || "EUR",
    commission_rate: commission.commission_rate,
    commission_amount: commission.commission_amount,
    net_amount: commission.net_amount,
    status: "pending",
    method: params.method,
    customer_id: params.customer_id,
    customer_email: params.customer_email,
    idempotency_key: params.idempotency_key,
    events: [createEvent("payment.initiated", "pending")],
  });

  // 6. Call provider
  try {
    const result = await provider.createPayment(tenantConfig, params);

    // 7. Update transaction with provider response
    transaction.provider_payment_id = result.provider_payment_id || "";
    transaction.status = result.success ? "processing" : "failed";
    transaction.events.push(
      createEvent(
        result.success ? "payment.provider_accepted" : "payment.provider_rejected",
        transaction.status
      )
    );

    if (!result.success) {
      transaction.failure_reason = result.error;
      transaction.failure_code = result.error_code;
    }

    await transaction.save();

    return {
      ...result,
      transaction_id: transactionId,
    };
  } catch (error) {
    // Provider call failed
    transaction.status = "failed";
    transaction.failure_reason = error instanceof Error ? error.message : "Unknown error";
    transaction.events.push(createEvent("payment.provider_error", "failed"));
    await transaction.save();

    return {
      success: false,
      transaction_id: transactionId,
      error: transaction.failure_reason,
    };
  }
}

// ============================================
// MOTO PAYMENT
// ============================================

/**
 * Process a MOTO payment (operator-initiated, card-not-present).
 */
export async function processMotoPayment(
  tenantDb: mongoose.Connection,
  options: Omit<ProcessPaymentOptions, "paymentType">,
  params: MotoPaymentParams
): Promise<PaymentResult> {
  const provider = getProvider(options.providerName);
  if (!provider?.supportsMoto || !provider.createMotoPayment) {
    return { success: false, error: `Provider ${options.providerName} does not support MOTO` };
  }

  return processPayment(tenantDb, { ...options, paymentType: "moto" }, {
    order_id: params.order_id,
    amount: params.amount,
    currency: params.currency,
    idempotency_key: params.idempotency_key,
  });
}

// ============================================
// RECURRING CHARGE
// ============================================

/**
 * Charge a recurring contract (MIT, no 3DS).
 */
export async function chargeRecurring(
  tenantDb: mongoose.Connection,
  options: Omit<ProcessPaymentOptions, "paymentType">,
  contractId: string,
  params: RecurringChargeParams
): Promise<PaymentResult> {
  const provider = getProvider(options.providerName);
  if (!provider?.supportsRecurring || !provider.chargeRecurring) {
    return { success: false, error: `Provider ${options.providerName} does not support recurring` };
  }

  const tenantConfig = await getProviderConfig(tenantDb, options.tenantId, options.providerName);
  if (!tenantConfig) {
    return { success: false, error: `Provider not configured` };
  }

  // Get contract
  const registry = getModelRegistry(tenantDb);
  const RecurringContract = registry.RecurringContract;
  const contract = await RecurringContract.findOne({ contract_id: contractId });

  if (!contract || contract.status !== "active") {
    return { success: false, error: "Contract not found or not active" };
  }

  return processPayment(tenantDb, { ...options, paymentType: "recurrent" }, {
    order_id: params.order_id,
    amount: params.amount,
    currency: params.currency,
    idempotency_key: params.idempotency_key,
  });
}

// ============================================
// REFUND
// ============================================

/**
 * Refund a transaction (full or partial).
 */
export async function refundTransaction(
  tenantDb: mongoose.Connection,
  transactionId: string,
  amount?: number
): Promise<RefundResult> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const transaction = await PaymentTransaction.findOne({
    transaction_id: transactionId,
  });
  if (!transaction) {
    return { success: false, error: "Transaction not found" };
  }

  const provider = getProvider(transaction.provider);
  if (!provider) {
    return { success: false, error: `Unknown provider: ${transaction.provider}` };
  }

  const tenantConfig = await getProviderConfig(
    tenantDb,
    transaction.tenant_id,
    transaction.provider
  );
  if (!tenantConfig) {
    return { success: false, error: "Provider not configured" };
  }

  const result = await provider.refundPayment(
    tenantConfig,
    transaction.provider_payment_id,
    amount
  );

  if (result.success) {
    transaction.status = amount ? "partial_refund" : "refunded";
    transaction.events.push(
      createEvent("payment.refunded", transaction.status, {
        refund_amount: amount || transaction.gross_amount,
      })
    );
    await transaction.save();
  }

  return result;
}

// ============================================
// HELPERS
// ============================================

function createEvent(
  eventType: string,
  status: string,
  metadata?: Record<string, unknown>
): IPaymentEvent {
  return {
    event_type: eventType,
    status,
    timestamp: new Date(),
    metadata,
  };
}

async function findByIdempotencyKey(
  tenantDb: mongoose.Connection,
  key: string
): Promise<IPaymentTransaction | null> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;
  return PaymentTransaction.findOne({ idempotency_key: key }).lean();
}

async function getProviderConfig(
  tenantDb: mongoose.Connection,
  tenantId: string,
  providerName: string
): Promise<Record<string, unknown> | null> {
  const registry = getModelRegistry(tenantDb);
  const TenantPaymentConfig = registry.TenantPaymentConfig;

  const config = await TenantPaymentConfig.findOne({ tenant_id: tenantId }).lean();
  if (!config?.providers) return null;

  const providers = config.providers as Record<string, unknown>;
  return (providers[providerName] as Record<string, unknown>) || null;
}
