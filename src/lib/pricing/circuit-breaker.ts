/**
 * Per-Tenant Circuit Breaker for Pricing Providers
 *
 * Prevents noisy-neighbor issues: when one tenant's pricing engine is down,
 * requests for that tenant fail fast instead of blocking resources.
 */

import { PRICING_DEFAULTS } from "@/lib/constants/pricing-provider";
import type { ICircuitBreakerConfig } from "@/lib/types/pricing-provider";

type CircuitStatus = "closed" | "open" | "half_open";

interface CircuitState {
  status: CircuitStatus;
  failure_count: number;
  success_count: number;
  last_failure_at: number;
  opened_at: number;
}

// In-memory state per tenant
const circuits = new Map<string, CircuitState>();

function getState(tenantId: string): CircuitState {
  let state = circuits.get(tenantId);
  if (!state) {
    state = {
      status: "closed",
      failure_count: 0,
      success_count: 0,
      last_failure_at: 0,
      opened_at: 0,
    };
    circuits.set(tenantId, state);
  }
  return state;
}

function getConfig(config?: Partial<ICircuitBreakerConfig>): ICircuitBreakerConfig {
  return {
    failure_threshold:
      config?.failure_threshold ??
      PRICING_DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    recovery_timeout_ms:
      config?.recovery_timeout_ms ??
      PRICING_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
    success_threshold:
      config?.success_threshold ??
      PRICING_DEFAULTS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
  };
}

/**
 * Check if a request is allowed through the circuit breaker.
 * Returns true if the request can proceed, false if circuit is open.
 */
export function isCircuitOpen(
  tenantId: string,
  cbConfig?: Partial<ICircuitBreakerConfig>
): boolean {
  const state = getState(tenantId);
  const config = getConfig(cbConfig);

  if (state.status === "closed") return false;

  if (state.status === "open") {
    // Check if recovery timeout has elapsed → transition to half_open
    const elapsed = Date.now() - state.opened_at;
    if (elapsed >= config.recovery_timeout_ms) {
      state.status = "half_open";
      state.success_count = 0;
      return false; // Allow one test request through
    }
    return true; // Circuit is open, block the request
  }

  // half_open: allow requests through for testing
  return false;
}

/**
 * Record a successful pricing call for a tenant.
 */
export function recordSuccess(
  tenantId: string,
  cbConfig?: Partial<ICircuitBreakerConfig>
): void {
  const state = getState(tenantId);
  const config = getConfig(cbConfig);

  if (state.status === "half_open") {
    state.success_count++;
    if (state.success_count >= config.success_threshold) {
      // Recovered — close the circuit
      state.status = "closed";
      state.failure_count = 0;
      state.success_count = 0;
      console.log(`[Pricing] Circuit closed for tenant ${tenantId} — provider recovered`);
    }
  } else if (state.status === "closed") {
    // Reset failure count on success
    state.failure_count = 0;
  }
}

/**
 * Record a failed pricing call for a tenant.
 */
export function recordFailure(
  tenantId: string,
  cbConfig?: Partial<ICircuitBreakerConfig>
): void {
  const state = getState(tenantId);
  const config = getConfig(cbConfig);

  state.failure_count++;
  state.last_failure_at = Date.now();

  if (state.status === "half_open") {
    // Failed during recovery test — reopen circuit
    state.status = "open";
    state.opened_at = Date.now();
    console.log(`[Pricing] Circuit re-opened for tenant ${tenantId} — recovery attempt failed`);
  } else if (
    state.status === "closed" &&
    state.failure_count >= config.failure_threshold
  ) {
    state.status = "open";
    state.opened_at = Date.now();
    console.log(
      `[Pricing] Circuit opened for tenant ${tenantId} after ${state.failure_count} consecutive failures`
    );
  }
}

/**
 * Get current circuit state for a tenant (for admin UI / debugging).
 */
export function getCircuitState(tenantId: string): CircuitState & { tenant_id: string } {
  return { tenant_id: tenantId, ...getState(tenantId) };
}
