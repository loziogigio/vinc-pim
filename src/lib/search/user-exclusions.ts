/**
 * Resolve admin-configured per-channel user-exclusion rules into concrete
 * { solr_field, value } pairs for a given customer/address.
 *
 * Pure / DB-free: the search route loads the catalog_settings rules and the
 * customer record, then calls this to produce the exclusions that become
 * negative Solr fq clauses (`-<solr_field>:<value>`) in query-builder.
 *
 * v1 supports a single user_field source: "address_country".
 */

export interface UserExclusionRule {
  enabled?: boolean;
  /** Logical source CS knows how to resolve (closed enum). v1: "address_country". */
  user_field?: string;
  /** The item's multivalued exclusion field, e.g. "attribute_erp_user_country_exclude_ss". */
  solr_field?: string;
  /** Optional admin note. */
  label?: string;
}

export interface ResolvedExclusion {
  solr_field: string;
  value: string;
}

interface ExclusionAddress {
  external_code?: string;
  country?: string;
  is_default?: boolean;
}

export interface ExclusionCustomerCtx {
  addresses?: ExclusionAddress[];
}

/** Pick the address that drives `address_country`: selected by code, else default. */
function pickAddress(
  customer: ExclusionCustomerCtx,
  addressCode?: string
): ExclusionAddress | null {
  const addresses = customer.addresses ?? [];
  if (addressCode) {
    const selected = addresses.find((a) => a.external_code === addressCode);
    if (selected) return selected;
  }
  return addresses.find((a) => a.is_default === true) ?? null;
}

/** Resolve one rule's user_field to a concrete string value, or null to skip. */
function resolveRuleValue(
  rule: UserExclusionRule,
  customer: ExclusionCustomerCtx,
  addressCode?: string
): string | null {
  if (rule.user_field === "address_country") {
    const address = pickAddress(customer, addressCode);
    const country = address?.country?.trim();
    return country ? country : null;
  }
  // Unknown / not-yet-supported source → skip.
  return null;
}

export function resolveUserExclusions(
  rules: UserExclusionRule[] | undefined,
  customer: ExclusionCustomerCtx | null,
  addressCode?: string
): ResolvedExclusion[] {
  if (!customer || !rules?.length) return [];

  const out: ResolvedExclusion[] = [];
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const solrField = rule.solr_field?.trim();
    if (!solrField) continue;
    const value = resolveRuleValue(rule, customer, addressCode);
    if (!value) continue;
    out.push({ solr_field: solrField, value });
  }
  return out;
}
