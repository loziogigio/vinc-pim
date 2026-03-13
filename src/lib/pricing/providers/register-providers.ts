/**
 * Pricing Provider Auto-Registration
 *
 * Imports and registers all pricing provider implementations.
 * Call initializePricingProviders() once at startup to populate the registry.
 */

import { registerPricingProvider } from "./provider-registry";
import { legacyErpProvider } from "./legacy-erp/client";
import { genericHttpProvider } from "./generic-http/client";

let initialized = false;

/**
 * Register all pricing providers in the registry.
 * Safe to call multiple times — only registers once.
 */
export function initializePricingProviders(): void {
  if (initialized) return;

  registerPricingProvider(legacyErpProvider);
  registerPricingProvider(genericHttpProvider);

  initialized = true;
}
