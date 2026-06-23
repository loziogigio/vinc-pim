/**
 * Project product-level promotions onto packaging options.
 *
 * Precedence: a packaging option's OWN promotions (explicitly stored — e.g. from a
 * sync that sets packaging-level promotions carrying their own `tag_filter` for
 * agent/customer targeting) are authoritative and kept as-is. Product-level
 * promotions are projected only onto packagings that have none of their own:
 *   - target_pkg_ids empty/undefined → all sellable packaging (is_sellable !== false)
 *   - target_pkg_ids set             → only those specific pkg_ids
 *
 * This is read-time only — never persisted. It is the single source of truth for
 * three surfaces that must agree: the product-detail GET, the search response
 * enricher, and the Solr indexer. Keeping the logic here (a dependency-free pure
 * function) avoids the three previous inline copies drifting apart.
 */

interface PackagingLike {
  pkg_id?: string;
  is_sellable?: boolean;
  promotions?: unknown[];
  [key: string]: unknown;
}

interface PromotionLike {
  target_pkg_ids?: string[];
  [key: string]: unknown;
}

export function embedPromotionsInPackaging<T extends PackagingLike>(
  packagingOptions: T[] | undefined,
  promotions: PromotionLike[] | undefined,
): T[] | undefined {
  // Nothing to project (no packagings, or no product-level promotions): return the
  // packagings untouched, preserving any promotions they already carry.
  if (!packagingOptions?.length || !promotions?.length) return packagingOptions;

  return packagingOptions.map((pkg) => {
    // Explicit packaging-level promotions win — they may carry packaging-specific
    // tag_filter. Only project product-level promotions onto packagings with none.
    if (Array.isArray(pkg.promotions) && pkg.promotions.length > 0) return pkg;

    return {
      ...pkg,
      promotions: promotions.filter((promo) => {
        if (!promo.target_pkg_ids || promo.target_pkg_ids.length === 0) {
          return pkg.is_sellable !== false;
        }
        return promo.target_pkg_ids.includes(pkg.pkg_id as string);
      }),
    } as T;
  });
}
