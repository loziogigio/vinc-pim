/**
 * Pricing Service — Single Entry Point
 *
 * Orchestrates pricing requests: loads tenant config, selects provider,
 * applies circuit breaker, and normalizes errors.
 */

import { connectWithModels } from "@/lib/db/connection";
import { initializePricingProviders } from "./providers/register-providers";
import { getPricingProvider } from "./providers/provider-registry";
import { isCircuitOpen, recordSuccess, recordFailure } from "./circuit-breaker";
import { nanoid } from "nanoid";
import type {
  IPricingRequest,
  IPricingResponse,
  IPricingErrors,
  ErpPriceData,
} from "@/lib/types/pricing-provider";
import type { PricingLogStatus } from "@/lib/db/models/pricing-request-log";

// In-memory config cache (per tenant)
const configCache = new Map<
  string,
  { config: any; cached_at: number }
>();
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadTenantConfig(tenantDb: string, tenantId: string) {
  const cached = configCache.get(tenantId);
  if (cached && Date.now() - cached.cached_at < CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }

  const { TenantPricingConfig } = await connectWithModels(tenantDb);
  const config = await TenantPricingConfig.findOne({ tenant_id: tenantId }).lean();

  if (config) {
    configCache.set(tenantId, { config, cached_at: Date.now() });
  }

  return config;
}

/**
 * Fire-and-forget: write a pricing request log entry.
 */
async function logPricingRequest(
  tenantDb: string,
  data: {
    provider: string;
    entity_codes: string[];
    customer_code: string;
    status: PricingLogStatus;
    resolved_count: number;
    error_count: number;
    errors?: IPricingErrors;
    duration_ms: number;
    attempt_count: number;
  }
) {
  const { PricingRequestLog } = await connectWithModels(tenantDb);
  await PricingRequestLog.create({
    log_id: `prl_${nanoid(12)}`,
    provider: data.provider,
    entity_codes: data.entity_codes,
    entity_count: data.entity_codes.length,
    customer_code: data.customer_code,
    status: data.status,
    resolved_count: data.resolved_count,
    error_count: data.error_count,
    errors: data.errors,
    duration_ms: data.duration_ms,
    attempt_count: data.attempt_count,
  });
}

/**
 * Resolve prices for a set of products via the tenant's configured provider.
 */
export async function resolvePrices(
  tenantDb: string,
  tenantId: string,
  request: IPricingRequest
): Promise<IPricingResponse> {
  const startTime = Date.now();

  // Initialize providers (idempotent)
  initializePricingProviders();

  // Load tenant pricing config
  const tenantConfig = await loadTenantConfig(tenantDb, tenantId);

  if (!tenantConfig) {
    console.log(`[Pricing] No pricing config for tenant ${tenantId}, returning empty`);
    // No config = no provider activity, skip logging
    return { status: "success", data: {} };
  }

  const providerName = tenantConfig.active_provider;
  const provider = getPricingProvider(providerName);

  if (!provider) {
    console.error(`[Pricing] Unknown provider "${providerName}" for tenant ${tenantId}`);
    const response: IPricingResponse = {
      status: "success",
      data: {},
      errors: { provider_error: `Unknown provider: ${providerName}` },
    };

    void logPricingRequest(tenantDb, {
      provider: providerName,
      entity_codes: request.entity_codes,
      customer_code: request.customer_code,
      status: "failed",
      resolved_count: 0,
      error_count: request.entity_codes.length,
      errors: response.errors,
      duration_ms: Date.now() - startTime,
      attempt_count: 0,
    }).catch(() => {});

    return response;
  }

  // Check circuit breaker
  if (isCircuitOpen(tenantId, tenantConfig.circuit_breaker)) {
    console.log(`[Pricing] Circuit open for tenant ${tenantId}, skipping provider call`);
    const response: IPricingResponse = {
      status: "success",
      data: {},
      errors: {
        provider_error: "Pricing service temporarily unavailable (circuit open)",
        timed_out: request.entity_codes,
      },
    };

    void logPricingRequest(tenantDb, {
      provider: providerName,
      entity_codes: request.entity_codes,
      customer_code: request.customer_code,
      status: "circuit_open",
      resolved_count: 0,
      error_count: request.entity_codes.length,
      errors: response.errors,
      duration_ms: Date.now() - startTime,
      attempt_count: 0,
    }).catch(() => {});

    return response;
  }

  // Get provider-specific config
  const providerConfig =
    tenantConfig.providers?.[providerName as keyof typeof tenantConfig.providers];

  if (!providerConfig || !providerConfig.enabled) {
    console.log(
      `[Pricing] Provider "${providerName}" not configured or disabled for tenant ${tenantId}`
    );
    return {
      status: "success",
      data: {},
      errors: { provider_error: `Provider "${providerName}" is not enabled` },
    };
  }

  // Call provider with retries
  const maxRetries = tenantConfig.fallback?.max_retries ?? 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await provider.getPrices(providerConfig, request);

      // Validate required fields per entity_code
      const validData: Record<string, ErpPriceData> = {};
      const invalidCodes: string[] = [];

      for (const [code, priceData] of Object.entries(data)) {
        if (
          priceData &&
          typeof priceData.net_price === "number" &&
          typeof priceData.gross_price === "number" &&
          typeof priceData.price === "number"
        ) {
          validData[code] = priceData;
        } else {
          invalidCodes.push(code);
          if (tenantConfig.fallback?.log_errors) {
            console.error(
              `[Pricing] Invalid price data for entity_code "${code}" from provider "${providerName}" (tenant ${tenantId})`
            );
          }
        }
      }

      recordSuccess(tenantId, tenantConfig.circuit_breaker);

      const response: IPricingResponse = {
        status: "success",
        data: validData,
      };

      if (invalidCodes.length > 0) {
        response.errors = { invalid_response: invalidCodes };
      }

      void logPricingRequest(tenantDb, {
        provider: providerName,
        entity_codes: request.entity_codes,
        customer_code: request.customer_code,
        status: "success",
        resolved_count: Object.keys(validData).length,
        error_count: invalidCodes.length,
        errors: response.errors,
        duration_ms: Date.now() - startTime,
        attempt_count: attempt + 1,
      }).catch(() => {});

      return response;
    } catch (err: any) {
      lastError = err;

      const isTimeout =
        err.name === "AbortError" || err.message?.includes("timed out");

      if (tenantConfig.fallback?.log_errors) {
        console.error(
          `[Pricing] Provider "${providerName}" failed for tenant ${tenantId} (attempt ${attempt + 1}/${maxRetries + 1}):`,
          err.message
        );
      }

      // Only retry on non-timeout errors (timeouts are already slow)
      if (isTimeout || attempt >= maxRetries) {
        recordFailure(tenantId, tenantConfig.circuit_breaker);

        const response: IPricingResponse = {
          status: "success",
          data: {},
          errors: {
            provider_error: err.message,
            ...(isTimeout ? { timed_out: request.entity_codes } : {}),
          },
        };

        void logPricingRequest(tenantDb, {
          provider: providerName,
          entity_codes: request.entity_codes,
          customer_code: request.customer_code,
          status: isTimeout ? "timed_out" : "failed",
          resolved_count: 0,
          error_count: request.entity_codes.length,
          errors: response.errors,
          duration_ms: Date.now() - startTime,
          attempt_count: attempt + 1,
        }).catch(() => {});

        return response;
      }
    }
  }

  // Shouldn't reach here, but safety net
  recordFailure(tenantId, tenantConfig.circuit_breaker);
  const response: IPricingResponse = {
    status: "success",
    data: {},
    errors: { provider_error: lastError?.message || "Unknown error" },
  };

  void logPricingRequest(tenantDb, {
    provider: providerName,
    entity_codes: request.entity_codes,
    customer_code: request.customer_code,
    status: "failed",
    resolved_count: 0,
    error_count: request.entity_codes.length,
    errors: response.errors,
    duration_ms: Date.now() - startTime,
    attempt_count: maxRetries + 1,
  }).catch(() => {});

  return response;
}

/**
 * Invalidate cached config for a tenant (call after config updates).
 */
export function invalidatePricingConfigCache(tenantId: string): void {
  configCache.delete(tenantId);
}
