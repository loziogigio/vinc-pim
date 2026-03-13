import { describe, it, expect, beforeEach } from "vitest";
import type { IPricingProvider } from "@/lib/pricing/providers/provider-interface";

// Test with isolated registry to avoid global state from register-providers
describe("unit: Pricing Provider Registry", () => {
  // We test the registry functions directly by importing them
  // The registry is a module-level Map, so we test the public API

  it("should register and retrieve a provider", async () => {
    /**
     * Test basic registration and lookup.
     */
    const {
      registerPricingProvider,
      getPricingProvider,
      hasPricingProvider,
    } = await import("@/lib/pricing/providers/provider-registry");

    const mockProvider: IPricingProvider = {
      name: "test_provider",
      label: "Test Provider",
      supportsCustomerPricing: true,
      supportsBatchPricing: true,
      supportsQuantityBreaks: false,
      getPrices: async () => ({}),
      testConnection: async () => ({ success: true }),
    };

    registerPricingProvider(mockProvider);

    expect(hasPricingProvider("test_provider")).toBe(true);
    expect(getPricingProvider("test_provider")).toBe(mockProvider);
  });

  it("should return undefined for unknown provider", async () => {
    const { getPricingProvider } = await import(
      "@/lib/pricing/providers/provider-registry"
    );

    expect(getPricingProvider("nonexistent_provider")).toBeUndefined();
  });

  it("should list all registered providers", async () => {
    const { getAllPricingProviders } = await import(
      "@/lib/pricing/providers/provider-registry"
    );

    const providers = getAllPricingProviders();
    expect(Array.isArray(providers)).toBe(true);
    // At least the test_provider from the first test
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });

  it("should initialize all built-in providers", async () => {
    /**
     * Test that initializePricingProviders registers both providers.
     */
    const { initializePricingProviders } = await import(
      "@/lib/pricing/providers/register-providers"
    );
    const { hasPricingProvider } = await import(
      "@/lib/pricing/providers/provider-registry"
    );

    initializePricingProviders();

    expect(hasPricingProvider("legacy_erp")).toBe(true);
    expect(hasPricingProvider("generic_http")).toBe(true);
  });

  it("should be idempotent — calling initialize twice is safe", async () => {
    const { initializePricingProviders } = await import(
      "@/lib/pricing/providers/register-providers"
    );
    const { getAllPricingProviders } = await import(
      "@/lib/pricing/providers/provider-registry"
    );

    initializePricingProviders();
    const countBefore = getAllPricingProviders().length;

    initializePricingProviders();
    const countAfter = getAllPricingProviders().length;

    expect(countAfter).toBe(countBefore);
  });
});
