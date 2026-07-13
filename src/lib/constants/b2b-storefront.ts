/**
 * Shared contract for the B2B storefront configuration stored on an admin
 * tenant. vinc-b2b reads these values directly from vinc-admin.tenants.
 */

export const B2B_STOREFRONT_TEMPLATES = [
  {
    id: "default",
    label: "Default",
    description: "Standard VINC B2B storefront.",
  },
  {
    id: "time",
    label: "Time",
    description: "Time storefront with its dedicated B2B components.",
  },
] as const;

export type B2BStorefrontTemplate =
  (typeof B2B_STOREFRONT_TEMPLATES)[number]["id"];

export const DEFAULT_B2B_STOREFRONT_TEMPLATE: B2BStorefrontTemplate = "default";

export const B2B_STOREFRONT_TEMPLATE_IDS = B2B_STOREFRONT_TEMPLATES.map(
  ({ id }) => id,
) as B2BStorefrontTemplate[];

export const B2B_PRICING_SOURCES = [
  {
    id: "inline",
    label: "Inline catalog (default)",
    description:
      "Use price information already stored on the PIM product. No ERP request is made.",
  },
  {
    id: "erp",
    label: "ERP",
    description:
      "Load customer-specific prices and availability from the configured ERP connection.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description:
      "Show inline prices immediately, then replace customer-specific values with ERP data.",
  },
] as const;

export type B2BPricingSource = (typeof B2B_PRICING_SOURCES)[number]["id"];

export const DEFAULT_B2B_PRICING_SOURCE: B2BPricingSource = "inline";

export const B2B_PRICING_SOURCE_IDS = B2B_PRICING_SOURCES.map(
  ({ id }) => id,
) as B2BPricingSource[];

export function isB2BStorefrontTemplate(
  value: unknown,
): value is B2BStorefrontTemplate {
  return B2B_STOREFRONT_TEMPLATE_IDS.includes(value as B2BStorefrontTemplate);
}

export function isB2BPricingSource(value: unknown): value is B2BPricingSource {
  return B2B_PRICING_SOURCE_IDS.includes(value as B2BPricingSource);
}
