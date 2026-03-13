import { describe, it, expect } from "vitest";
import { legacyErpProvider } from "@/lib/pricing/providers/legacy-erp/client";
import { genericHttpProvider } from "@/lib/pricing/providers/generic-http/client";

describe("unit: Pricing Provider Implementations", () => {
  describe("legacyErpProvider", () => {
    it("should have correct name and label", () => {
      expect(legacyErpProvider.name).toBe("legacy_erp");
      expect(legacyErpProvider.label).toBe("Legacy ERP (Python API)");
    });

    it("should support all capability flags", () => {
      expect(legacyErpProvider.supportsCustomerPricing).toBe(true);
      expect(legacyErpProvider.supportsBatchPricing).toBe(true);
      expect(legacyErpProvider.supportsQuantityBreaks).toBe(true);
    });

    it("should implement getPrices and testConnection", () => {
      expect(typeof legacyErpProvider.getPrices).toBe("function");
      expect(typeof legacyErpProvider.testConnection).toBe("function");
    });
  });

  describe("genericHttpProvider", () => {
    it("should have correct name and label", () => {
      expect(genericHttpProvider.name).toBe("generic_http");
      expect(genericHttpProvider.label).toBe("Generic HTTP");
    });

    it("should have conservative capability flags", () => {
      /**
       * Generic HTTP is a generic adapter — customer pricing and quantity breaks
       * depend on the external API, so defaults are conservative (false).
       */
      expect(genericHttpProvider.supportsCustomerPricing).toBe(false);
      expect(genericHttpProvider.supportsBatchPricing).toBe(true);
      expect(genericHttpProvider.supportsQuantityBreaks).toBe(false);
    });

    it("should implement getPrices and testConnection", () => {
      expect(typeof genericHttpProvider.getPrices).toBe("function");
      expect(typeof genericHttpProvider.testConnection).toBe("function");
    });
  });
});
