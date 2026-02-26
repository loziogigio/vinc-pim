/**
 * Provider Auto-Registration
 *
 * Imports and registers all payment provider implementations.
 * Call initializeProviders() once at startup to populate the registry.
 */

import { registerProvider } from "./provider-registry";
import { stripeProvider } from "./stripe/client";
import { nexiProvider } from "./nexi/client";
import { axerveProvider } from "./axerve/client";
import { paypalProvider } from "./paypal/client";
import { mangopayProvider } from "./mangopay/client";

let initialized = false;

/**
 * Register all payment providers in the registry.
 * Safe to call multiple times — only registers once.
 */
export function initializeProviders(): void {
  if (initialized) return;

  registerProvider(stripeProvider);
  registerProvider(nexiProvider);
  registerProvider(axerveProvider);
  registerProvider(paypalProvider);
  registerProvider(mangopayProvider);

  initialized = true;
}
