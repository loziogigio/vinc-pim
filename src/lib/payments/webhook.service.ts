/**
 * Webhook Processing Service
 *
 * Shared logic for handling incoming payment provider webhooks.
 * Loads webhook secrets from per-tenant MongoDB config — never from env vars.
 *
 * Security flow:
 *   1. Require tenant_id (reject anonymous webhooks)
 *   2. Load tenant's provider config from MongoDB
 *   3. Verify signature using provider-specific method
 *   4. Parse into normalized WebhookEvent
 *   5. Enqueue for async processing (BullMQ)
 */

import { getPooledConnection } from "@/lib/db/connection";
import { getProviderConfig } from "./payment.service";
import { getProvider } from "./providers/provider-registry";
import { initializeProviders } from "./providers/register-providers";
import type { WebhookEvent } from "@/lib/types/payment";

export interface WebhookProcessResult {
  success: boolean;
  event_id?: string;
  event_type?: string;
  error?: string;
}

/**
 * Maps provider name → the config key that holds the webhook secret.
 */
const WEBHOOK_SECRET_KEYS: Record<string, string> = {
  paypal: "webhook_id",
  stripe: "webhook_secret",
  nexi: "api_key",
  axerve: "api_key",
  mangopay: "api_key",
};

/**
 * Process an incoming webhook from a payment provider.
 *
 * Loads the webhook secret from the tenant's payment config in MongoDB.
 * Verifies the signature using the provider's official method.
 * Enqueues the event for async processing (fast ACK to provider).
 */
export async function processWebhook(
  providerName: string,
  payload: string,
  signature: string,
  tenantId: string
): Promise<WebhookProcessResult> {
  // 1. Require tenant
  if (!tenantId) {
    return { success: false, error: "Missing tenant parameter" };
  }

  // 2. Initialize + resolve provider
  initializeProviders();
  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, error: `Unknown provider: ${providerName}` };
  }

  // 3. Load tenant's provider config from MongoDB
  const tenantDb = `vinc-${tenantId}`;
  const connection = await getPooledConnection(tenantDb);
  const tenantConfig = await getProviderConfig(connection, tenantId, providerName);

  if (!tenantConfig) {
    return { success: false, error: `Provider ${providerName} not configured for tenant ${tenantId}` };
  }

  // 4. Extract webhook secret from tenant config
  const secretKey = WEBHOOK_SECRET_KEYS[providerName] || "api_key";
  const webhookSecret = (tenantConfig[secretKey] as string) || "";

  // 5. Verify signature (may be async, e.g. PayPal calls their API)
  const isValid = await provider.verifyWebhookSignature(payload, signature, webhookSecret);
  if (!isValid) {
    return { success: false, error: "Invalid webhook signature" };
  }

  // 6. Parse the event
  let event: WebhookEvent;
  try {
    event = provider.parseWebhookEvent(payload);
  } catch (error) {
    return { success: false, error: `Failed to parse webhook: ${(error as Error).message}` };
  }

  // 7. Enqueue for async processing
  try {
    const { paymentQueue } = await import("@/lib/queue/queues");
    await paymentQueue.add(
      "payment.webhook",
      {
        provider: providerName,
        event,
        tenant_id: tenantId,
        received_at: new Date().toISOString(),
      },
      {
        jobId: `webhook-${providerName}-${event.event_id}`,
        removeOnComplete: { count: 1000 },
      }
    );
  } catch (error) {
    // Log but don't fail — the event was verified successfully
    console.error(`Failed to enqueue webhook job for ${providerName}:`, error);
  }

  return {
    success: true,
    event_id: event.event_id,
    event_type: event.event_type,
  };
}
