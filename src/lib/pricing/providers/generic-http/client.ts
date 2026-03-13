/**
 * Generic HTTP Pricing Provider
 *
 * For new pricing engines with different API structures.
 * Uses response_mapping to normalize external responses to ErpPriceData.
 */

import type {
  ErpPriceData,
  IPricingRequest,
  IGenericHttpProviderConfig,
} from "@/lib/types/pricing-provider";
import type {
  IPricingProvider,
  PricingProviderTenantConfig,
  TestConnectionResult,
} from "../provider-interface";

function getConfig(
  tenantConfig: PricingProviderTenantConfig
): IGenericHttpProviderConfig {
  return tenantConfig as unknown as IGenericHttpProviderConfig;
}

function buildHeaders(config: IGenericHttpProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.auth_method === "bearer" && config.bearer_token) {
    headers["Authorization"] = `Bearer ${config.bearer_token}`;
  } else if (config.auth_method === "api_key" && config.api_key) {
    headers["x-api-key"] = config.api_key;
  } else if (config.auth_method === "basic" && config.api_key && config.api_secret) {
    const encoded = Buffer.from(`${config.api_key}:${config.api_secret}`).toString(
      "base64"
    );
    headers["Authorization"] = `Basic ${encoded}`;
  }

  // Merge custom headers
  if (config.custom_headers) {
    const customHeaders =
      config.custom_headers instanceof Map
        ? Object.fromEntries(config.custom_headers)
        : (config.custom_headers as Record<string, string>);
    Object.assign(headers, customHeaders);
  }

  return headers;
}

/**
 * Extract a nested value from an object using dot notation.
 * e.g., getNestedValue(obj, "prices.net") → obj.prices.net
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * Map an external price item to ErpPriceData using the configured field mapping.
 */
function mapToErpPriceData(
  item: any,
  entityCode: string,
  mapping: IGenericHttpProviderConfig["response_mapping"]
): ErpPriceData | null {
  const netPrice = Number(getNestedValue(item, mapping.net_price_field));
  const grossPrice = Number(getNestedValue(item, mapping.gross_price_field));
  const price = Number(getNestedValue(item, mapping.price_field));

  // Validate required numeric fields
  if (isNaN(netPrice) || isNaN(grossPrice) || isNaN(price)) {
    return null;
  }

  const vatPercent = mapping.vat_percent_field
    ? Number(getNestedValue(item, mapping.vat_percent_field)) || 0
    : 0;

  const availability = mapping.availability_field
    ? Number(getNestedValue(item, mapping.availability_field)) || 0
    : 0;

  let discount: number[] = [];
  if (mapping.discount_field) {
    const rawDiscount = getNestedValue(item, mapping.discount_field);
    discount = Array.isArray(rawDiscount) ? rawDiscount.map(Number) : [];
  }

  return {
    entity_code: entityCode,
    net_price: netPrice,
    gross_price: grossPrice,
    price,
    price_discount: netPrice, // Default to net_price if not mapped
    vat_percent: vatPercent,
    availability,
    discount,
    discount_description: discount.filter((v) => v !== 0).map((v) => `${v}%`).join(" "),
  };
}

export const genericHttpProvider: IPricingProvider = {
  name: "generic_http",
  label: "Generic HTTP",

  supportsCustomerPricing: false,
  supportsBatchPricing: true,
  supportsQuantityBreaks: false,

  async getPrices(
    tenantConfig: PricingProviderTenantConfig,
    request: IPricingRequest
  ): Promise<Record<string, ErpPriceData>> {
    const config = getConfig(tenantConfig);
    const baseUrl = config.api_base_url.replace(/\/$/, "");
    const endpoint = config.endpoint.startsWith("/")
      ? config.endpoint
      : `/${config.endpoint}`;
    const url = `${baseUrl}${endpoint}`;

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
          customer_code: request.customer_code,
          address_code: request.address_code,
          id_cart: request.id_cart,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Generic HTTP provider returned ${response.status}: ${response.statusText}`
        );
      }

      const json = await response.json();

      // Try to extract data — support both { data: { ... } } and flat { ... } formats
      const rawData = json?.data ?? json;
      const result: Record<string, ErpPriceData> = {};

      if (typeof rawData === "object" && rawData !== null) {
        for (const [key, item] of Object.entries<any>(rawData)) {
          const entityCode =
            config.response_mapping.entity_code_field
              ? String(getNestedValue(item, config.response_mapping.entity_code_field) ?? key)
              : key;

          const mapped = mapToErpPriceData(item, entityCode, config.response_mapping);
          if (mapped) {
            result[entityCode] = mapped;
          } else {
            console.error(
              `[Pricing:generic_http] Failed to map entity_code "${entityCode}" — missing required numeric fields`
            );
          }
        }
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
    const baseUrl = config.api_base_url.replace(/\/$/, "");
    const endpoint = config.endpoint.startsWith("/")
      ? config.endpoint
      : `/${config.endpoint}`;
    const url = `${baseUrl}${endpoint}`;
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
          customer_code: "",
          address_code: "",
          id_cart: "",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latency_ms = Date.now() - start;

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
