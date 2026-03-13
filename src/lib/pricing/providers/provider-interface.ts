/**
 * Pricing Provider Interface (Strategy Pattern)
 *
 * All pricing providers implement this interface.
 * PIM normalizes external responses to the ErpPriceData shape.
 */

import type { ErpPriceData, IPricingRequest } from "@/lib/types/pricing-provider";

/**
 * Provider-specific tenant configuration.
 * Extracted from ITenantPricingConfig.providers[providerName].
 */
export interface PricingProviderTenantConfig {
  [key: string]: unknown;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  latency_ms?: number;
}

export interface IPricingProvider {
  /** Provider identifier (matches PRICING_PROVIDERS constant) */
  readonly name: string;

  /** Human-readable label */
  readonly label: string;

  // ============================================
  // CAPABILITY FLAGS
  // ============================================

  /** Can factor in customer_code/address_code for customer-specific pricing */
  readonly supportsCustomerPricing: boolean;

  /** Can price multiple products in a single request */
  readonly supportsBatchPricing: boolean;

  /** Can factor in quantity for quantity-break pricing */
  readonly supportsQuantityBreaks: boolean;

  // ============================================
  // CORE OPERATIONS
  // ============================================

  /**
   * Get prices for a batch of products.
   * Returns normalized { [entity_code]: ErpPriceData }.
   */
  getPrices(
    tenantConfig: PricingProviderTenantConfig,
    request: IPricingRequest
  ): Promise<Record<string, ErpPriceData>>;

  /**
   * Test provider connection for admin UI health check.
   */
  testConnection(
    tenantConfig: PricingProviderTenantConfig
  ): Promise<TestConnectionResult>;
}
