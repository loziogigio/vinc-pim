/**
 * Payment System - Barrel Export
 *
 * Central export point for payment services, types, and providers.
 */

// Services
export {
  processPayment,
  processMotoPayment,
  chargeRecurring,
  refundTransaction,
} from "./payment.service";

export {
  calculateCommission,
  getTenantCommissionRate,
  recordCommission,
  getTenantCommissionSummary,
} from "./commission.service";

// Provider interface & registry
export type { IPaymentProvider, ProviderTenantConfig } from "./providers/provider-interface";
export {
  registerProvider,
  getProvider,
  getAllProviders,
  hasProvider,
} from "./providers/provider-registry";

// Provider initialization
export { initializeProviders } from "./providers/register-providers";

// Webhook processing
export { processWebhook } from "./webhook.service";
export type { WebhookProcessResult } from "./webhook.service";
