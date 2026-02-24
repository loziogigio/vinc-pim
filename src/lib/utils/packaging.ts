/**
 * Packaging Utilities
 *
 * Helper functions for packaging options: ID management, price calculations.
 * The pricing model stores unit prices and calculates package prices on the fly.
 */

import type { PackagingOption, PackagingPricing, PackagingInfo } from "@/lib/types/pim";

/**
 * Ensure every packaging option has a unique pkg_id (incremental string: "1", "2", "3"...).
 * Returns the original array reference if no changes were needed.
 */
export function ensurePackagingIds(options: PackagingOption[]): PackagingOption[] {
  let maxId = 0;
  for (const pkg of options) {
    const n = parseInt(String(pkg.pkg_id || "0"), 10);
    if (n > maxId) maxId = n;
  }

  let changed = false;
  const result = options.map((pkg) => {
    if (!pkg.pkg_id) {
      changed = true;
      return { ...pkg, pkg_id: String(++maxId) };
    }
    if (typeof pkg.pkg_id !== "string") {
      changed = true;
      return { ...pkg, pkg_id: String(pkg.pkg_id) };
    }
    return pkg;
  });
  return changed ? result : options;
}

/**
 * Ensure every promotion across all packaging options has a unique promo_row.
 * Auto-assigns incrementing promo_row to promotions that lack one.
 * Returns the original array reference if no changes were needed.
 */
export function ensurePromoRows(options: PackagingOption[]): PackagingOption[] {
  // Find current max promo_row across all packaging options
  let maxRow = 0;
  for (const pkg of options) {
    for (const promo of pkg.promotions || []) {
      if (promo.promo_row && promo.promo_row > maxRow) maxRow = promo.promo_row;
    }
  }

  let changed = false;
  const result = options.map((pkg) => {
    if (!pkg.promotions || pkg.promotions.length === 0) return pkg;

    const needsUpdate = pkg.promotions.some((p) => !p.promo_row);
    if (!needsUpdate) return pkg;

    changed = true;
    const updatedPromos = pkg.promotions.map((promo) => {
      if (promo.promo_row) return promo;
      return { ...promo, promo_row: ++maxRow };
    });
    return { ...pkg, promotions: updatedPromos };
  });

  return changed ? result : options;
}

/**
 * Calculate package price from unit price and quantity
 * @param unitPrice - Price per single unit
 * @param qty - Quantity in the package
 * @returns Package price (unit × qty), rounded to 2 decimals
 */
export function calculatePackagePrice(
  unitPrice: number | undefined,
  qty: number
): number | undefined {
  if (unitPrice === undefined || unitPrice === null) return undefined;
  return Math.round(unitPrice * qty * 100) / 100;
}

/**
 * Calculate unit price from package price and quantity
 * @param packagePrice - Total package price
 * @param qty - Quantity in the package
 * @returns Unit price (package ÷ qty), rounded to 2 decimals
 */
export function calculateUnitPrice(
  packagePrice: number | undefined,
  qty: number
): number | undefined {
  if (packagePrice === undefined || packagePrice === null || qty <= 0)
    return undefined;
  return Math.round((packagePrice / qty) * 100) / 100;
}

/**
 * Get display prices for a packaging option
 * Returns both unit and package prices, calculating missing values
 *
 * @param pricing - Pricing data (may have unit or package prices)
 * @param qty - Quantity in the package
 * @returns Object with unit and package prices
 */
export function getDisplayPrices(
  pricing: PackagingPricing | undefined,
  qty: number
): {
  list_unit?: number;
  retail_unit?: number;
  sale_unit?: number;
  list_pkg?: number;
  retail_pkg?: number;
  sale_pkg?: number;
} {
  if (!pricing) return {};

  // Prefer unit prices if available, otherwise calculate from package prices
  const list_unit =
    pricing.list_unit ?? calculateUnitPrice(pricing.list, qty);
  const retail_unit =
    pricing.retail_unit ?? calculateUnitPrice(pricing.retail, qty);
  const sale_unit =
    pricing.sale_unit ?? calculateUnitPrice(pricing.sale, qty);

  // Calculate package prices from unit prices
  const list_pkg =
    pricing.list ?? calculatePackagePrice(list_unit, qty);
  const retail_pkg =
    pricing.retail ?? calculatePackagePrice(retail_unit, qty);
  const sale_pkg =
    pricing.sale ?? calculatePackagePrice(sale_unit, qty);

  return {
    list_unit,
    retail_unit,
    sale_unit,
    list_pkg,
    retail_pkg,
    sale_pkg,
  };
}

/**
 * Sync package prices from unit prices
 * Call this before saving to ensure package prices are in sync
 *
 * @param pricing - Pricing data with unit prices
 * @param qty - Quantity in the package
 * @returns Updated pricing with calculated package prices
 */
export function syncPackagePrices(
  pricing: PackagingPricing | undefined,
  qty: number
): PackagingPricing | undefined {
  if (!pricing) return undefined;

  return {
    ...pricing,
    // Keep unit prices as stored
    list_unit: pricing.list_unit,
    retail_unit: pricing.retail_unit,
    sale_unit: pricing.sale_unit,
    // Calculate package prices from unit prices
    list: calculatePackagePrice(pricing.list_unit, qty) ?? pricing.list,
    retail:
      calculatePackagePrice(pricing.retail_unit, qty) ?? pricing.retail,
    sale: calculatePackagePrice(pricing.sale_unit, qty) ?? pricing.sale,
  };
}

/**
 * Get the effective display price for a packaging option
 * Priority: sale > retail > list (for display in lists)
 *
 * @param pricing - Pricing data
 * @param qty - Quantity in the package
 * @param priceType - 'unit' or 'package'
 * @returns The effective price and its type
 */
export function getEffectivePrice(
  pricing: PackagingPricing | undefined,
  qty: number,
  priceType: "unit" | "package" = "package"
): { price?: number; type: "sale" | "retail" | "list" | null } {
  if (!pricing) return { price: undefined, type: null };

  const prices = getDisplayPrices(pricing, qty);

  if (priceType === "unit") {
    if (prices.sale_unit !== undefined)
      return { price: prices.sale_unit, type: "sale" };
    if (prices.retail_unit !== undefined)
      return { price: prices.retail_unit, type: "retail" };
    if (prices.list_unit !== undefined)
      return { price: prices.list_unit, type: "list" };
  } else {
    if (prices.sale_pkg !== undefined)
      return { price: prices.sale_pkg, type: "sale" };
    if (prices.retail_pkg !== undefined)
      return { price: prices.retail_pkg, type: "retail" };
    if (prices.list_pkg !== undefined)
      return { price: prices.list_pkg, type: "list" };
  }

  return { price: undefined, type: null };
}

/**
 * Sync is_default/is_smallest flags on packaging_options from packaging_info.
 * packaging_info is the source of truth — is_default/is_smallest booleans on each entry
 * map to a code that matches a packaging_option code.
 */
export function syncPackagingFlags(
  packagingOptions: PackagingOption[],
  packagingInfo: PackagingInfo[] | undefined
): PackagingOption[] {
  const defaultCode = packagingInfo?.find((pi) => pi.is_default)?.code;
  const smallestCode = packagingInfo?.find((pi) => pi.is_smallest)?.code;

  return packagingOptions.map((opt) => ({
    ...opt,
    is_default: defaultCode ? opt.code === defaultCode : false,
    is_smallest: smallestCode ? opt.code === smallestCode : false,
  }));
}

/**
 * Get the default packaging option from a list
 */
export function getDefaultPackaging(
  options: PackagingOption[] | undefined
): PackagingOption | undefined {
  if (!options || options.length === 0) return undefined;
  return options.find((opt) => opt.is_default) || options[0];
}

/**
 * Get the smallest (unit) packaging option from a list
 */
export function getSmallestPackaging(
  options: PackagingOption[] | undefined
): PackagingOption | undefined {
  if (!options || options.length === 0) return undefined;
  return options.find((opt) => opt.is_smallest) || options[0];
}

/**
 * Format price for display with currency symbol
 */
export function formatPrice(
  price: number | undefined,
  currency: string = "EUR",
  locale: string = "it-IT"
): string {
  if (price === undefined || price === null) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(price);
}

/**
 * Format unit price with "/pz" suffix
 */
export function formatUnitPrice(
  price: number | undefined,
  currency: string = "EUR",
  uom: string = "pz",
  locale: string = "it-IT"
): string {
  if (price === undefined || price === null) return "-";
  return `${formatPrice(price, currency, locale)}/${uom}`;
}
