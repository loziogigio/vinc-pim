/**
 * Webhook Processing Service
 *
 * Shared logic for handling incoming payment provider webhooks.
 * Each provider route handler calls processWebhook() after
 * verifying the provider-specific signature.
 */

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
 * Process an incoming webhook from a payment provider.
 *
 * 1. Verify signature
 * 2. Parse into normalized WebhookEvent
 * 3. Enqueue for async processing (via BullMQ payment queue)
 *
 * Returns immediately after verification + enqueue (fast ACK).
 */
export async function processWebhook(
  providerName: string,
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<WebhookProcessResult> {
  // Ensure providers are registered
  initializeProviders();

  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, error: `Unknown provider: ${providerName}` };
  }

  // Verify signature
  const isValid = provider.verifyWebhookSignature(payload, signature, webhookSecret);
  if (!isValid) {
    return { success: false, error: "Invalid webhook signature" };
  }

  // Parse the event
  let event: WebhookEvent;
  try {
    event = provider.parseWebhookEvent(payload);
  } catch (error) {
    return { success: false, error: `Failed to parse webhook: ${(error as Error).message}` };
  }

  // Enqueue for async processing
  try {
    const { paymentQueue } = await import("@/lib/queue/queues");
    await paymentQueue.add(
      "payment.webhook",
      {
        provider: providerName,
        event,
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
