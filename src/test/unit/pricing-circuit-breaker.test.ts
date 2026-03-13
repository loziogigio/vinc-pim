import { describe, it, expect, beforeEach } from "vitest";
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  getCircuitState,
} from "@/lib/pricing/circuit-breaker";

describe("unit: Pricing Circuit Breaker", () => {
  // Use unique tenant IDs per test to avoid cross-test state pollution
  let tenantCounter = 0;
  const nextTenant = () => `cb-test-${++tenantCounter}-${Date.now()}`;

  describe("initial state", () => {
    it("should start with circuit closed", () => {
      const tenantId = nextTenant();
      const state = getCircuitState(tenantId);

      expect(state.status).toBe("closed");
      expect(state.failure_count).toBe(0);
    });

    it("should allow requests through when closed", () => {
      const tenantId = nextTenant();

      expect(isCircuitOpen(tenantId)).toBe(false);
    });
  });

  describe("failure tracking", () => {
    it("should keep circuit closed below failure threshold", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 3, recovery_timeout_ms: 30000, success_threshold: 1 };

      recordFailure(tenantId, config);
      recordFailure(tenantId, config);

      expect(isCircuitOpen(tenantId, config)).toBe(false);
      expect(getCircuitState(tenantId).failure_count).toBe(2);
    });

    it("should open circuit after reaching failure threshold", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 3, recovery_timeout_ms: 30000, success_threshold: 1 };

      recordFailure(tenantId, config);
      recordFailure(tenantId, config);
      recordFailure(tenantId, config);

      expect(isCircuitOpen(tenantId, config)).toBe(true);
      expect(getCircuitState(tenantId).status).toBe("open");
    });

    it("should reset failure count on success", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 3, recovery_timeout_ms: 30000, success_threshold: 1 };

      recordFailure(tenantId, config);
      recordFailure(tenantId, config);
      recordSuccess(tenantId, config);

      expect(getCircuitState(tenantId).failure_count).toBe(0);
    });
  });

  describe("recovery", () => {
    it("should transition to half_open after recovery timeout", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 1, recovery_timeout_ms: 0, success_threshold: 1 };

      // Open the circuit
      recordFailure(tenantId, config);
      expect(getCircuitState(tenantId).status).toBe("open");

      // With 0ms recovery, should immediately transition to half_open
      const open = isCircuitOpen(tenantId, config);
      expect(open).toBe(false); // allowed through for test
      expect(getCircuitState(tenantId).status).toBe("half_open");
    });

    it("should close circuit after success in half_open", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 1, recovery_timeout_ms: 0, success_threshold: 1 };

      // Open → half_open
      recordFailure(tenantId, config);
      isCircuitOpen(tenantId, config); // transitions to half_open

      // Record success in half_open
      recordSuccess(tenantId, config);

      expect(getCircuitState(tenantId).status).toBe("closed");
      expect(getCircuitState(tenantId).failure_count).toBe(0);
    });

    it("should reopen circuit on failure in half_open", () => {
      const tenantId = nextTenant();
      const config = { failure_threshold: 1, recovery_timeout_ms: 0, success_threshold: 1 };

      // Open → half_open
      recordFailure(tenantId, config);
      isCircuitOpen(tenantId, config);

      // Fail during recovery
      recordFailure(tenantId, config);

      expect(getCircuitState(tenantId).status).toBe("open");
    });
  });

  describe("tenant isolation", () => {
    it("should maintain independent circuits per tenant", () => {
      const tenantA = nextTenant();
      const tenantB = nextTenant();
      const config = { failure_threshold: 2, recovery_timeout_ms: 30000, success_threshold: 1 };

      // Open circuit for tenant A
      recordFailure(tenantA, config);
      recordFailure(tenantA, config);

      // Tenant B should be unaffected
      expect(isCircuitOpen(tenantA, config)).toBe(true);
      expect(isCircuitOpen(tenantB, config)).toBe(false);
    });
  });
});
