/**
 * Payment Webhook Worker
 * Processes queued payment webhook events from BullMQ
 *
 * Handles events from all payment providers (PayPal, Stripe, Nexi, etc.)
 * and updates transaction status accordingly.
 *
 * Usage:
 *   pnpm worker:payment
 */

import { Worker, Job } from "bullmq";
import mongoose from "mongoose";
import { getPooledConnection } from "../src/lib/db/connection";
import { getModelRegistry } from "../src/lib/db/model-registry";
import {
  capturePayment,
  completeTransactionFromCallback,
  failTransactionFromCallback,
} from "../src/lib/payments/payment.service";
import { extractProviderPaymentId } from "../src/lib/payments/callback-events";
import { initializeProviders } from "../src/lib/payments/providers/register-providers";
import { closeAllConnections } from "../src/lib/db/connection-pool";
import type { WebhookEvent } from "../src/lib/types/payment";

// ============================================
// TYPES
// ============================================

interface WebhookJobData {
  provider: string;
  event: WebhookEvent;
  tenant_id?: string;
  received_at: string;
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * PayPal events that indicate a payment is approved and ready for capture.
 */
const PAYPAL_CAPTURE_EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "CHECKOUT.ORDER.COMPLETED",
  "PAYMENT.CAPTURE.COMPLETED",
];

/**
 * Process a single webhook job.
 */
async function processWebhookJob(job: Job<WebhookJobData>): Promise<{ processed: boolean; event_type: string }> {
  const { provider, event, tenant_id } = job.data;

  console.log(`[Payment Worker] Processing ${provider} event: ${event.event_type} (${event.event_id})`);

  if (!tenant_id) {
    console.warn(`[Payment Worker] No tenant_id for event ${event.event_id} — skipping`);
    return { processed: false, event_type: event.event_type };
  }

  const tenantDb = `vinc-${tenant_id}`;
  const connection = await getPooledConnection(tenantDb);
  const registry = getModelRegistry(connection);
  const PaymentTransaction = registry.PaymentTransaction;

  // Extract provider_payment_id from event data
  const providerPaymentId = extractProviderPaymentId(provider, event);
  if (!providerPaymentId) {
    console.warn(`[Payment Worker] Cannot extract provider_payment_id from ${provider} event`);
    return { processed: false, event_type: event.event_type };
  }

  // Find the transaction
  const transaction = await PaymentTransaction.findOne({
    provider_payment_id: providerPaymentId,
    provider,
  });

  if (!transaction) {
    console.warn(`[Payment Worker] No transaction found for ${provider}:${providerPaymentId}`);
    return { processed: false, event_type: event.event_type };
  }

  // Record the webhook event in the transaction's audit trail
  transaction.events.push({
    event_type: `webhook.${event.event_type}`,
    status: transaction.status,
    timestamp: new Date(),
    provider_event_id: event.event_id,
  });

  // Axerve/GestPay settles on its side: the decrypted callback is the final word.
  // The helpers below re-fetch and save the document themselves, so the audit event
  // pushed above is intentionally discarded — they write their own.
  if (provider === "axerve") {
    const data = event.data as Record<string, unknown>;

    if (event.event_type === "payment.completed") {
      const result = await completeTransactionFromCallback(
        connection,
        providerPaymentId,
        "axerve",
        {
          provider_capture_id: (data.bank_transaction_id as string) || undefined,
          authorization_code: (data.authorization_code as string) || undefined,
        }
      );
      console.log(
        `[Payment Worker] Axerve ${providerPaymentId} → ${result.success ? "completed" : "error"}`
      );
    } else {
      await failTransactionFromCallback(connection, providerPaymentId, "axerve", {
        reason: (data.error_description as string) || "GestPay reported KO",
        code: (data.error_code as string) || undefined,
      });
      console.log(`[Payment Worker] Axerve ${providerPaymentId} → failed`);
    }

    return { processed: true, event_type: event.event_type };
  }

  // Handle capture if needed
  if (shouldCapture(provider, event) && transaction.status === "processing") {
    console.log(`[Payment Worker] Capturing transaction ${transaction.transaction_id}`);

    // Ensure providers are initialized
    initializeProviders();

    const result = await capturePayment(connection, transaction.transaction_id);

    if (result.success) {
      console.log(`[Payment Worker] Captured ${transaction.transaction_id} → completed`);
    } else {
      console.error(`[Payment Worker] Capture failed for ${transaction.transaction_id}: ${result.error}`);
    }

    return { processed: true, event_type: event.event_type };
  }

  // For non-capture events, just save the audit trail update
  await transaction.save();

  return { processed: true, event_type: event.event_type };
}

/**
 * Determine if this webhook event should trigger a capture.
 */
function shouldCapture(provider: string, event: WebhookEvent): boolean {
  switch (provider) {
    case "paypal":
      return PAYPAL_CAPTURE_EVENTS.includes(event.event_type);

    case "stripe":
      return event.event_type === "payment_intent.succeeded";

    case "nexi":
      return event.event_type === "PAYMENT_COMPLETED";

    case "mangopay":
      return event.event_type === "PAYIN_NORMAL_SUCCEEDED";

    default:
      return false;
  }
}

// ============================================
// WORKER SETUP
// ============================================

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

console.log("[Payment Worker] Starting...");
console.log(`[Payment Worker] Redis: ${redisHost}:${redisPort}`);

// Connect to MongoDB for admin/shared operations
const mongoUrl = process.env.VINC_MONGO_URL || "mongodb://localhost:27017";
mongoose.connect(mongoUrl).then(() => {
  console.log("[Payment Worker] MongoDB connected");
}).catch((err) => {
  console.error("[Payment Worker] MongoDB connection failed:", err);
});

const worker = new Worker(
  "payment-queue",
  async (job: Job<WebhookJobData>) => {
    return processWebhookJob(job);
  },
  {
    connection: {
      host: redisHost,
      port: redisPort,
    },
    concurrency: 3,
  }
);

worker.on("completed", (job, result) => {
  console.log(`[Payment Worker] Job ${job.id} completed: ${result?.event_type} (processed: ${result?.processed})`);
});

worker.on("failed", (job, err) => {
  console.error(`[Payment Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Payment Worker] Worker error:", err);
});

console.log("[Payment Worker] Ready and listening for jobs");

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Payment Worker] Shutting down...");
  await worker.close();
  await mongoose.disconnect();
  await closeAllConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Payment Worker] Shutting down...");
  await worker.close();
  await mongoose.disconnect();
  await closeAllConnections();
  process.exit(0);
});
