/**
 * Pricing Provider Constants
 */

export const PRICING_PROVIDERS = ["legacy_erp", "generic_http"] as const;
export type PricingProvider = (typeof PRICING_PROVIDERS)[number];

export const PRICING_PROVIDER_LABELS: Record<PricingProvider, string> = {
  legacy_erp: "Legacy ERP (Python API)",
  generic_http: "Generic HTTP",
};

export const PRICING_DEFAULTS = {
  CACHE_TTL_SECONDS: 60,
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 1,
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: 30000,
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD: 1,
} as const;

export const PRICING_AUTH_METHODS = [
  "bearer",
  "api_key",
  "basic",
  "none",
] as const;
export type PricingAuthMethod = (typeof PRICING_AUTH_METHODS)[number];
