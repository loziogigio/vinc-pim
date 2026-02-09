/**
 * Tag-Based Pricing Resolution Service
 *
 * Resolves effective customer tags (customer defaults + address overrides)
 * and filters promotions/pricing based on tag matching.
 *
 * Override logic:
 * 1. Start with customer's default tags
 * 2. For each tag in the address's tag_overrides, replace customer tags with same prefix
 * 3. Result = effective tag set for this customer+address combo
 */

import type { ICustomer, IAddress } from "@/lib/db/models/customer";
import type { ICustomerTagRef } from "@/lib/db/models/customer-tag";
import type { Promotion, PackagingOption, PackagingPricing } from "@/lib/types/pim";
import { connectWithModels } from "@/lib/db/connection";

// ============================================
// TAG RESOLUTION
// ============================================

/**
 * Resolve the effective tag set for a customer + delivery address.
 *
 * Address tag_overrides replace customer tags with the same prefix.
 * Tags from different prefixes are merged.
 *
 * @returns Array of full_tag strings (e.g., ["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"])
 */
export function resolveEffectiveTags(
  customer: Pick<ICustomer, "tags">,
  address?: Pick<IAddress, "tag_overrides"> | null,
): string[] {
  const customerTags = customer.tags || [];
  const addressOverrides = address?.tag_overrides || [];

  if (addressOverrides.length === 0) {
    return customerTags.map((t) => t.full_tag);
  }

  // Collect prefixes that are overridden by the address
  const overriddenPrefixes = new Set(addressOverrides.map((t) => t.prefix));

  // Keep customer tags whose prefix is NOT overridden, then add address overrides
  const merged: ICustomerTagRef[] = [
    ...customerTags.filter((t) => !overriddenPrefixes.has(t.prefix)),
    ...addressOverrides,
  ];

  return merged.map((t) => t.full_tag);
}

/**
 * Resolve effective tags from raw tag ref arrays (for use without full document objects).
 */
export function resolveEffectiveTagsFromRefs(
  customerTags: ICustomerTagRef[],
  addressOverrides: ICustomerTagRef[],
): string[] {
  if (addressOverrides.length === 0) {
    return customerTags.map((t) => t.full_tag);
  }

  const overriddenPrefixes = new Set(addressOverrides.map((t) => t.prefix));

  const merged = [
    ...customerTags.filter((t) => !overriddenPrefixes.has(t.prefix)),
    ...addressOverrides,
  ];

  return merged.map((t) => t.full_tag);
}

// ============================================
// PROMOTION FILTERING
// ============================================

/**
 * Filter promotions based on customer's effective tags.
 *
 * - Promotions with empty/no tag_filter → apply to ALL customers
 * - Promotions with tag_filter → apply only if at least one tag matches
 */
export function filterPromotionsByTags(
  promotions: Promotion[],
  effectiveTags: string[],
): Promotion[] {
  if (effectiveTags.length === 0) {
    // No tags → only untagged promotions apply
    return promotions.filter((p) => !p.tag_filter || p.tag_filter.length === 0);
  }

  const tagSet = new Set(effectiveTags);

  return promotions.filter((promo) => {
    // No tag_filter → applies to all
    if (!promo.tag_filter || promo.tag_filter.length === 0) return true;
    // Has tag_filter → must match at least one customer tag
    return promo.tag_filter.some((tag) => tagSet.has(tag));
  });
}

// ============================================
// PRICING RESOLUTION
// ============================================

/**
 * Check if a pricing's tag_filter matches the customer's effective tags.
 * No tag_filter = matches all (fallback pricing).
 */
function pricingMatchesTags(
  pricing: PackagingPricing | undefined,
  effectiveTags: Set<string>,
): { matches: boolean; specificity: number } {
  if (!pricing) return { matches: false, specificity: 0 };

  const tagFilter = pricing.tag_filter;
  if (!tagFilter || tagFilter.length === 0) {
    // No filter = universal fallback (low specificity)
    return { matches: true, specificity: 0 };
  }

  // Has tag_filter → check for match
  const hasMatch = tagFilter.some((tag) => effectiveTags.has(tag));
  return { matches: hasMatch, specificity: hasMatch ? tagFilter.length : 0 };
}

/**
 * Resolve packaging options by filtering pricing and promotions based on tags.
 *
 * For each packaging option:
 * - If pricing has tag_filter, pick the best matching pricing (most specific)
 * - Filter promotions by tag match
 *
 * Returns a new array of PackagingOption with resolved pricing and promotions.
 */
export function resolvePackagingByTags(
  packagingOptions: PackagingOption[],
  effectiveTags: string[],
): PackagingOption[] {
  const tagSet = new Set(effectiveTags);

  return packagingOptions.map((pkg) => {
    // Resolve pricing: if tagged, check match; if not tagged, keep as-is
    let resolvedPricing = pkg.pricing;
    if (resolvedPricing?.tag_filter && resolvedPricing.tag_filter.length > 0) {
      const { matches } = pricingMatchesTags(resolvedPricing, tagSet);
      if (!matches) {
        // Tagged pricing doesn't match — clear it (no price for this customer)
        resolvedPricing = undefined;
      }
    }

    // Resolve promotions
    const resolvedPromotions = pkg.promotions
      ? filterPromotionsByTags(pkg.promotions, effectiveTags)
      : undefined;

    return {
      ...pkg,
      pricing: resolvedPricing,
      promotions: resolvedPromotions,
    };
  });
}

// ============================================
// TAG ASSIGNMENT HELPERS
// ============================================

/**
 * Add a tag ref to an array, replacing any existing tag with the same prefix
 * (within the same prefix, only one tag is allowed).
 */
export function upsertTagRef(
  tags: ICustomerTagRef[],
  newTag: ICustomerTagRef,
): ICustomerTagRef[] {
  const filtered = tags.filter((t) => t.prefix !== newTag.prefix);
  return [...filtered, newTag];
}

/**
 * Remove a tag ref by full_tag.
 */
export function removeTagRef(
  tags: ICustomerTagRef[],
  fullTag: string,
): ICustomerTagRef[] {
  return tags.filter((t) => t.full_tag !== fullTag);
}

// ============================================
// BATCH TAG UPSERT (for customer import)
// ============================================

export interface TagUpsertResult {
  applied: string[];
  skipped: string[];
  tags: ICustomerTagRef[];
}

/**
 * Upsert tags on a customer by resolving full_tag strings to tag refs.
 * Looks up tag definitions, builds refs, and upserts onto the customer.
 * Unknown or inactive tags are silently skipped.
 */
export async function upsertCustomerTagsBatch(
  tenantDb: string,
  tenantId: string,
  customerId: string,
  fullTags: string[],
): Promise<TagUpsertResult> {
  if (!fullTags || fullTags.length === 0) {
    return { applied: [], skipped: [], tags: [] };
  }

  const { Customer: CustomerModel, CustomerTag: CustomerTagModel } =
    await connectWithModels(tenantDb);

  // Look up all tag definitions in one query
  const tagDefs = await CustomerTagModel.find({
    full_tag: { $in: fullTags },
    is_active: true,
  }).lean();

  const foundTags = new Set(
    tagDefs.map((t: { full_tag: string }) => t.full_tag)
  );
  const applied = fullTags.filter((ft) => foundTags.has(ft));
  const skipped = fullTags.filter((ft) => !foundTags.has(ft));

  if (applied.length === 0) {
    return { applied: [], skipped, tags: [] };
  }

  // Get current customer
  const customer = await CustomerModel.findOne({
    customer_id: customerId,
    tenant_id: tenantId,
  });
  if (!customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  // Build refs and upsert each
  let currentTags: ICustomerTagRef[] = customer.tags || [];
  for (const tagDef of tagDefs) {
    const ref: ICustomerTagRef = {
      tag_id: (tagDef as { tag_id: string }).tag_id,
      full_tag: (tagDef as { full_tag: string }).full_tag,
      prefix: (tagDef as { prefix: string }).prefix,
      code: (tagDef as { code: string }).code,
    };
    currentTags = upsertTagRef(currentTags, ref);
  }

  // Save
  await CustomerModel.updateOne(
    { customer_id: customerId, tenant_id: tenantId },
    { $set: { tags: currentTags } },
  );

  return { applied, skipped, tags: currentTags };
}

/**
 * Upsert tag overrides on a customer address.
 * Looks up tag definitions, builds refs, and upserts onto the address.
 * Unknown or inactive tags are silently skipped.
 */
export async function upsertAddressTagOverridesBatch(
  tenantDb: string,
  tenantId: string,
  customerId: string,
  addressId: string,
  fullTags: string[],
): Promise<TagUpsertResult> {
  if (!fullTags || fullTags.length === 0) {
    return { applied: [], skipped: [], tags: [] };
  }

  const { Customer: CustomerModel, CustomerTag: CustomerTagModel } =
    await connectWithModels(tenantDb);

  // Look up all tag definitions in one query
  const tagDefs = await CustomerTagModel.find({
    full_tag: { $in: fullTags },
    is_active: true,
  }).lean();

  const foundTags = new Set(
    tagDefs.map((t: { full_tag: string }) => t.full_tag)
  );
  const applied = fullTags.filter((ft) => foundTags.has(ft));
  const skipped = fullTags.filter((ft) => !foundTags.has(ft));

  if (applied.length === 0) {
    return { applied: [], skipped, tags: [] };
  }

  // Get current customer
  const customer = await CustomerModel.findOne({
    customer_id: customerId,
    tenant_id: tenantId,
  });
  if (!customer) {
    throw new Error(`Customer not found: ${customerId}`);
  }

  const addressIndex = (customer.addresses || []).findIndex(
    (a: { address_id: string }) => a.address_id === addressId,
  );
  if (addressIndex === -1) {
    throw new Error(`Address not found: ${addressId}`);
  }

  // Build refs and upsert each
  let currentOverrides: ICustomerTagRef[] =
    customer.addresses[addressIndex].tag_overrides || [];
  for (const tagDef of tagDefs) {
    const ref: ICustomerTagRef = {
      tag_id: (tagDef as { tag_id: string }).tag_id,
      full_tag: (tagDef as { full_tag: string }).full_tag,
      prefix: (tagDef as { prefix: string }).prefix,
      code: (tagDef as { code: string }).code,
    };
    currentOverrides = upsertTagRef(currentOverrides, ref);
  }

  // Save
  await CustomerModel.updateOne(
    { customer_id: customerId, tenant_id: tenantId },
    { $set: { [`addresses.${addressIndex}.tag_overrides`]: currentOverrides } },
  );

  return { applied, skipped, tags: currentOverrides };
}
