/**
 * Legacy ERP Pricing Provider
 *
 * Wraps the existing Python ERP API (FastAPI) that vinc-b2b currently calls directly.
 * Response is already in the expected ErpPriceData format — minimal normalization needed.
 */

import type {
  ErpPriceData,
  IPricingRequest,
  ILegacyErpProviderConfig,
} from "@/lib/types/pricing-provider";
import type {
  IPricingProvider,
  PricingProviderTenantConfig,
  TestConnectionResult,
} from "../provider-interface";

function getConfig(tenantConfig: PricingProviderTenantConfig): ILegacyErpProviderConfig {
  return tenantConfig as unknown as ILegacyErpProviderConfig;
}

function buildHeaders(config: ILegacyErpProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.auth_method === "bearer" && config.bearer_token) {
    headers["Authorization"] = `Bearer ${config.bearer_token}`;
  } else if (config.auth_method === "api_key" && config.api_key) {
    headers["x-api-key"] = config.api_key;
  }

  return headers;
}

export const legacyErpProvider: IPricingProvider = {
  name: "legacy_erp",
  label: "Legacy ERP (Python API)",

  supportsCustomerPricing: true,
  supportsBatchPricing: true,
  supportsQuantityBreaks: true,

  async getPrices(
    tenantConfig: PricingProviderTenantConfig,
    request: IPricingRequest
  ): Promise<Record<string, ErpPriceData>> {
    const config = getConfig(tenantConfig);
    const url = `${config.api_base_url.replace(/\/$/, "")}/erp/get_multiple_prices`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeout_ms || 5000
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify({
          entity_codes: request.entity_codes,
          quantity_list: request.quantity_list,
          id_cart: request.id_cart,
          customer_code: request.customer_code,
          address_code: request.address_code,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Legacy ERP returned ${response.status}: ${response.statusText}`
        );
      }

      const json = await response.json();

      if (json?.status !== "success" || !json.data) {
        throw new Error(
          `Legacy ERP returned unexpected status: ${json?.status}`
        );
      }

      // Response is already in the expected format — pass through
      const result: Record<string, ErpPriceData> = {};
      for (const [entityCode, raw] of Object.entries<any>(json.data)) {
        result[entityCode] = {
          ...raw,
          entity_code: entityCode,
          discount: raw.discount ?? [],
          discount_description: raw.discount_description ?? "",
        };
      }

      return result;
    } finally {
      clearTimeout(timeout);
    }
  },

  async testConnection(
    tenantConfig: PricingProviderTenantConfig
  ): Promise<TestConnectionResult> {
    const config = getConfig(tenantConfig);
    const url = `${config.api_base_url.replace(/\/$/, "")}/erp/get_multiple_prices`;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify({
          entity_codes: ["__test__"],
          quantity_list: [1],
          id_cart: "",
          customer_code: "",
          address_code: "",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latency_ms = Date.now() - start;

      // Any response (even error) means the server is reachable
      return {
        success: response.ok || response.status < 500,
        message: response.ok
          ? "Connected successfully"
          : `Server responded with ${response.status}`,
        latency_ms,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.name === "AbortError" ? "Connection timed out" : err.message,
        latency_ms: Date.now() - start,
      };
    }
  },
};
