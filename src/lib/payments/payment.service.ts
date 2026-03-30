/**
 * Payment Service
 *
 * Core payment orchestration with idempotency, commission calculation,
 * and provider delegation. Thin orchestrator following separation of concerns.
 */

import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { getModelRegistry } from "@/lib/db/model-registry";
import { getNextPaymentNumber } from "@/lib/db/models/counter";
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
import { recordGatewayPayment, reverseGatewayPayment } from "@/lib/services/order-lifecycle.service";

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

  // 1. Check idempotency — status-aware handler
  if (params.idempotency_key) {
    const idempotencyResult = await handleIdempotency(
      tenantDb,
      params.idempotency_key
    );
    if (idempotencyResult) return idempotencyResult;
    // null = proceed to create new payment (key was cleared or didn't exist)
  }

  // 2. Get provider
  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, error: `Unknown provider: ${providerName}` };
  }

  // 3. Get tenant config for this provider (manual provider needs no config)
  const tenantConfig = providerName === "manual"
    ? {}
    : await getProviderConfig(tenantDb, tenantId, providerName);
  if (!tenantConfig) {
    return { success: false, error: `Provider ${providerName} not configured for tenant` };
  }

  // 4. Calculate commission (per-provider rate if configured, otherwise generic)
  const commissionRate = await getTenantCommissionRate(tenantDb, tenantId, providerName);
  const commission = calculateCommission(params.amount, commissionRate, params.currency);

  // 5. Create transaction record
  const transactionId = `txn_${nanoid(16)}`;
  const year = new Date().getFullYear();
  const dbName = tenantDb.name; // e.g. "vinc-hidros-it"
  const seq = await getNextPaymentNumber(dbName, year);
  const paymentNumber = `PA/${seq}/${year}`;

  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const transaction = await PaymentTransaction.create({
    transaction_id: transactionId,
    payment_number: paymentNumber,
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

  // 6. Call provider (enrich params with payment_number for reference tracking)
  const enrichedParams = {
    ...params,
    metadata: {
      ...params.metadata,
      payment_number: paymentNumber,
    },
  };

  try {
    const result = await provider.createPayment(tenantConfig, enrichedParams);

    // 7. Update transaction with provider response
    transaction.provider_payment_id = result.provider_payment_id || "";
    transaction.status = result.success ? "processing" : "failed";
    transaction.events.push(
      createEvent(
        result.success ? "payment.provider_accepted" : "payment.provider_rejected",
        transaction.status
      )
    );

    // Store redirect data for idempotent "processing" lookups
    if (result.redirect_url) transaction.redirect_url = result.redirect_url;
    if (result.client_secret) transaction.client_secret = result.client_secret;

    if (!result.success) {
      transaction.failure_reason = result.error;
      transaction.failure_code = result.error_code;
    }

    await transaction.save();

    return {
      ...result,
      transaction_id: transactionId,
      payment_number: paymentNumber,
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
      payment_number: paymentNumber,
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
 * Refund a transaction (full or partial) with idempotency support.
 */
export async function refundTransaction(
  tenantDb: mongoose.Connection,
  transactionId: string,
  amount?: number,
  idempotencyKey?: string
): Promise<RefundResult> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const transaction = await PaymentTransaction.findOne({
    transaction_id: transactionId,
  });
  if (!transaction) {
    return { success: false, error: "Transaction not found" };
  }

  // Idempotency: check if a refund with this key already succeeded
  if (idempotencyKey) {
    const existingRefund = transaction.events.find(
      (e: IPaymentEvent) =>
        e.event_type === "payment.refunded" &&
        e.metadata?.idempotency_key === idempotencyKey
    );
    if (existingRefund) {
      return {
        success: true,
        idempotent: true,
        refund_id: existingRefund.metadata?.refund_id as string | undefined,
        amount: existingRefund.metadata?.refund_amount as number | undefined,
      };
    }
  }

  // Already fully refunded — no-op success
  if (transaction.status === "refunded") {
    return {
      success: true,
      idempotent: true,
      amount: transaction.gross_amount,
    };
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

  // Use capture ID for refund if available (PayPal refunds require capture ID, not order ID)
  const refundProviderId = transaction.provider_capture_id || transaction.provider_payment_id;
  const result = await provider.refundPayment(
    tenantConfig,
    refundProviderId,
    amount
  );

  if (result.success) {
    transaction.status = amount ? "partial_refund" : "refunded";
    transaction.events.push(
      createEvent("payment.refunded", transaction.status, {
        refund_amount: amount || transaction.gross_amount,
        refund_id: result.refund_id,
        ...(idempotencyKey && { idempotency_key: idempotencyKey }),
      })
    );
    await transaction.save();

    // Update the order's payment data to reflect the refund
    if (transaction.order_id) {
      try {
        await reverseGatewayPayment(
          tenantDb,
          transaction.order_id,
          transaction.transaction_id,
          amount // undefined = full refund, number = partial
        );
      } catch (err) {
        console.error(`[Payment] Failed to reverse order payment for ${transaction.order_id}:`, err);
      }
    }
  }

  return result;
}

// ============================================
// CAPTURE PAYMENT
// ============================================

/**
 * Capture a previously created payment (e.g. after PayPal redirect back).
 * Updates transaction status from "processing" → "completed" or "failed".
 */
export async function capturePayment(
  tenantDb: mongoose.Connection,
  transactionId: string
): Promise<PaymentResult> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const transaction = await PaymentTransaction.findOne({
    transaction_id: transactionId,
  });
  if (!transaction) {
    return { success: false, error: "Transaction not found" };
  }

  // Already captured
  if (transaction.status === "completed") {
    return {
      success: true,
      transaction_id: transaction.transaction_id,
      provider_payment_id: transaction.provider_payment_id,
      status: "completed",
    };
  }

  // Only capture transactions in "processing" state
  if (transaction.status !== "processing") {
    return {
      success: false,
      transaction_id: transaction.transaction_id,
      error: `Cannot capture transaction in "${transaction.status}" state`,
    };
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

  try {
    const result = await provider.capturePayment(
      tenantConfig,
      transaction.provider_payment_id
    );

    if (result.success) {
      transaction.status = "completed";
      transaction.completed_at = new Date();
      // Store provider capture/transaction ID (e.g., PayPal capture ID)
      if (result.provider_capture_id) {
        transaction.provider_capture_id = result.provider_capture_id;
      }
      transaction.events.push(
        createEvent("payment.captured", "completed")
      );
    } else {
      transaction.status = "failed";
      transaction.failure_reason = result.error;
      transaction.events.push(
        createEvent("payment.capture_failed", "failed", {
          error: result.error,
        })
      );
    }

    await transaction.save();

    // Auto-update the order's payment data after successful capture
    if (result.success && transaction.order_id) {
      try {
        await recordGatewayPayment(tenantDb, transaction.order_id, {
          amount: transaction.gross_amount,
          provider: transaction.provider,
          provider_payment_id: transaction.provider_payment_id,
          provider_capture_id: transaction.provider_capture_id,
          payment_type: transaction.payment_type,
          transaction_id: transaction.transaction_id,
          payment_number: transaction.payment_number,
        });
      } catch (err) {
        // Log but don't fail — transaction is already completed
        console.error(`[Payment] Failed to update order ${transaction.order_id}:`, err);
      }
    }

    return {
      ...result,
      transaction_id: transaction.transaction_id,
    };
  } catch (error) {
    transaction.status = "failed";
    transaction.failure_reason = error instanceof Error ? error.message : "Unknown error";
    transaction.events.push(createEvent("payment.capture_error", "failed"));
    await transaction.save();

    return {
      success: false,
      transaction_id: transaction.transaction_id,
      error: transaction.failure_reason,
    };
  }
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

/**
 * Status-aware idempotency handler.
 *
 * Returns a PaymentResult if the caller should stop (idempotent hit),
 * or null if the caller should proceed to create a new payment
 * (key didn't exist, or was cleared from a failed/cancelled transaction).
 */
async function handleIdempotency(
  tenantDb: mongoose.Connection,
  key: string
): Promise<PaymentResult | null> {
  const registry = getModelRegistry(tenantDb);
  const PaymentTransaction = registry.PaymentTransaction;

  const existing = await PaymentTransaction.findOne({ idempotency_key: key }).lean() as IPaymentTransaction | null;
  if (!existing) return null;

  const TERMINAL_SUCCESS = ["completed", "authorized", "captured", "refunded", "partial_refund"];
  const RETRYABLE = ["failed", "cancelled"];

  // Terminal success states — return idempotent success
  if (TERMINAL_SUCCESS.includes(existing.status)) {
    return {
      success: true,
      idempotent: true,
      transaction_id: existing.transaction_id,
      payment_number: existing.payment_number,
      provider_payment_id: existing.provider_payment_id,
      status: existing.status,
    };
  }

  // In-flight states (processing, pending) — return existing redirect data
  if (!RETRYABLE.includes(existing.status)) {
    return {
      success: true,
      idempotent: true,
      transaction_id: existing.transaction_id,
      payment_number: existing.payment_number,
      provider_payment_id: existing.provider_payment_id,
      redirect_url: existing.redirect_url,
      client_secret: existing.client_secret,
      status: existing.status,
    };
  }

  // Failed/cancelled — atomically clear idempotency_key so a new payment can reuse it.
  // The sparse unique index allows null, so the old record stays as audit evidence.
  const cleared = await PaymentTransaction.findOneAndUpdate(
    { idempotency_key: key, status: { $in: RETRYABLE } },
    {
      $set: { idempotency_key: null },
      $push: {
        events: createEvent("payment.idempotency_cleared", existing.status, {
          reason: "Retryable status — key released for new attempt",
        }),
      },
    }
  );

  if (!cleared) {
    // Race: another request already cleared the key or status changed.
    // Re-check — the winning request may have created a new transaction.
    const recheckExisting = await PaymentTransaction.findOne({ idempotency_key: key }).lean() as IPaymentTransaction | null;
    if (recheckExisting) {
      return handleIdempotency(tenantDb, key);
    }
  }

  // Key cleared (or was already gone) — proceed to create new payment
  return null;
}

export async function getProviderConfig(
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
