/**
 * Pricing Provider Registry
 *
 * Central registry for pricing provider implementations.
 * The PricingService looks them up by name.
 */

import type { IPricingProvider } from "./provider-interface";

const providers = new Map<string, IPricingProvider>();

/**
 * Register a pricing provider implementation.
 */
export function registerPricingProvider(provider: IPricingProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Get a registered pricing provider by name.
 */
export function getPricingProvider(
  name: string
): IPricingProvider | undefined {
  return providers.get(name);
}

/**
 * Get all registered pricing providers.
 */
export function getAllPricingProviders(): IPricingProvider[] {
  return Array.from(providers.values());
}

/**
 * Check if a pricing provider is registered.
 */
export function hasPricingProvider(name: string): boolean {
  return providers.has(name);
}
