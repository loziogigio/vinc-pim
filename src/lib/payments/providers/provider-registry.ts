/**
 * Provider Registry
 *
 * Central registry for payment provider implementations.
 * Providers register themselves here; the PaymentService looks them up by name.
 */

import type { IPaymentProvider } from "./provider-interface";

const providers = new Map<string, IPaymentProvider>();

/**
 * Register a payment provider implementation.
 */
export function registerProvider(provider: IPaymentProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Get a registered provider by name.
 */
export function getProvider(name: string): IPaymentProvider | undefined {
  return providers.get(name);
}

/**
 * Get all registered providers.
 */
export function getAllProviders(): IPaymentProvider[] {
  return Array.from(providers.values());
}

/**
 * Check if a provider is registered.
 */
export function hasProvider(name: string): boolean {
  return providers.has(name);
}
