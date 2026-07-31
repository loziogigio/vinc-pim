/**
 * Payment Callback Event Routing
 *
 * Pure helpers shared by the payment webhook worker. Kept out of workers/ so they
 * can be unit tested without constructing a BullMQ Worker or opening connections.
 */

import type { WebhookEvent } from "@/lib/types/payment";

/**
 * Extract the provider payment ID a webhook event refers to.
 * This is matched against PaymentTransaction.provider_payment_id.
 */
export function extractProviderPaymentId(
  provider: string,
  event: WebhookEvent
): string | null {
  const data = event.data as Record<string, unknown>;

  switch (provider) {
    case "paypal":
      // PayPal: resource.id is the order ID
      return (data.id as string) || null;

    case "stripe":
      // Stripe: data.object.payment_intent or data.object.id
      return (data.payment_intent as string) || (data.id as string) || null;

    case "axerve":
      // GestPay echoes back the shopTransactionId we sent, which is provider_payment_id.
      return (data.shop_transaction_id as string) || null;

    case "nexi":
    case "mangopay":
      // Generic: look for common ID fields
      return (data.id as string) || (data.transaction_id as string) || null;

    default:
      return (data.id as string) || null;
  }
}
