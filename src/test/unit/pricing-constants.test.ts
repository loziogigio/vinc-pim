import { describe, it, expect } from "vitest";
import {
  PRICING_PROVIDERS,
  PRICING_PROVIDER_LABELS,
  PRICING_DEFAULTS,
  PRICING_AUTH_METHODS,
} from "@/lib/constants/pricing-provider";

describe("unit: Pricing Provider Constants", () => {
  describe("PRICING_PROVIDERS", () => {
    it("should have exactly 2 providers", () => {
      expect(PRICING_PROVIDERS).toHaveLength(2);
    });

    it("should include legacy_erp and generic_http", () => {
      expect(PRICING_PROVIDERS).toContain("legacy_erp");
      expect(PRICING_PROVIDERS).toContain("generic_http");
    });
  });

  describe("PRICING_PROVIDER_LABELS", () => {
    it("should have a label for every provider", () => {
      for (const provider of PRICING_PROVIDERS) {
        expect(PRICING_PROVIDER_LABELS[provider]).toBeDefined();
        expect(PRICING_PROVIDER_LABELS[provider]).not.toBe("");
      }
    });

    it("should have correct labels", () => {
      expect(PRICING_PROVIDER_LABELS.legacy_erp).toBe("Legacy ERP (Python API)");
      expect(PRICING_PROVIDER_LABELS.generic_http).toBe("Generic HTTP");
    });
  });

  describe("PRICING_DEFAULTS", () => {
    it("should have reasonable default values", () => {
      expect(PRICING_DEFAULTS.CACHE_TTL_SECONDS).toBe(60);
      expect(PRICING_DEFAULTS.TIMEOUT_MS).toBe(5000);
      expect(PRICING_DEFAULTS.MAX_RETRIES).toBe(1);
    });

    it("should have circuit breaker defaults", () => {
      expect(PRICING_DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD).toBe(3);
      expect(PRICING_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS).toBe(30000);
      expect(PRICING_DEFAULTS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD).toBe(1);
    });
  });

  describe("PRICING_AUTH_METHODS", () => {
    it("should include all supported auth methods", () => {
      expect(PRICING_AUTH_METHODS).toContain("bearer");
      expect(PRICING_AUTH_METHODS).toContain("api_key");
      expect(PRICING_AUTH_METHODS).toContain("basic");
      expect(PRICING_AUTH_METHODS).toContain("none");
    });

    it("should have exactly 4 auth methods", () => {
      expect(PRICING_AUTH_METHODS).toHaveLength(4);
    });
  });
});
