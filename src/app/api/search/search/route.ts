/**
 * POST /api/search/search
 * Search products with filters, pagination, and sorting
 *
 * Supports both:
 * - API key authentication (for external clients)
 * - Session authentication (for B2B internal use like mobile-builder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { SolrError } from '@/lib/search/solr-client';
import { executeSearchWithFallback } from '@/lib/search/execute-search';
import { enrichFacetResults, enrichProductsWithVariants } from '@/lib/search/response-transformer';
import { enrichSearchResults, enrichVariantGroupedResults } from '@/lib/search/response-enricher';
import { SearchRequest } from '@/lib/types/search';
import { getSolrConfig, isSolrEnabled } from '@/config/project.config';
import { getB2BSession } from '@/lib/auth/b2b-session';
import { verifyAPIKeyFromRequest } from '@/lib/auth/api-key-auth';
import { validateAccessToken } from '@/lib/sso/tokens';
import { getSession } from '@/lib/sso/session';
import { resolveLivePortalAccess } from '@/lib/sso/live-portal-access';
import { connectWithModels } from '@/lib/db/connection';
import { resolveEffectiveTags } from '@/lib/services/tag-pricing.service';
import { loadUserExclusionsForSearch } from './exclusions-loader';
import { stripNonPublicForGuests } from '@/lib/search/strip-non-public';

interface VerifiedUserContext {
  customers: Array<{
    customerCode: string;
    addressCodes: Set<string>;
  }>;
}

type SearchSelection =
  | {
      allowed: true;
      customerCode?: string;
      addressCode?: string;
    }
  | { allowed: false };

/**
 * Validate the end-user bearer independently from the tenant API key. Proxy
 * headers are deliberately not trusted here: any API-key holder can set them.
 */
async function resolveVerifiedUserContext(
  request: NextRequest,
  expectedTenantId: string,
  tenantDb: string,
): Promise<VerifiedUserContext | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice(7).trim();
  if (!token || token === 'null') return null;

  try {
    const payload = await validateAccessToken(token);
    if (!payload || payload.tenant_id !== expectedTenantId) return null;

    const session = await getSession(payload.session_id);
    if (
      !session ||
      session.tenant_id !== expectedTenantId ||
      session.user_id !== payload.sub
    ) {
      return null;
    }

    const liveAccess = await resolveLivePortalAccess(
      tenantDb,
      expectedTenantId,
      payload.sub,
      session.vinc_profile,
    );
    if (!liveAccess) return null;

    return {
      customers: (liveAccess.profile?.customers ?? [])
        .filter(
          (customer) =>
            typeof customer.erp_customer_id === 'string' &&
            customer.erp_customer_id.length > 0,
        )
        .map((customer) => ({
          customerCode: customer.erp_customer_id,
          addressCodes: new Set(
            (customer.addresses ?? [])
              .map((address) => address.erp_address_id)
              .filter(
                (addressCode): addressCode is string =>
                  typeof addressCode === 'string' && addressCode.length > 0,
              ),
          ),
        })),
    };
  } catch (error) {
    console.warn(
      '[Search API] bearer validation failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Browser customer/address values are selection hints. For API-key requests,
 * accept a complete pair only when the validated SSO profile owns both. A
 * Suite session is tenant-admin context and may select a tenant customer.
 */
function resolveSearchSelection(
  authMethod: string | null,
  userContext: VerifiedUserContext | null,
  requestedCustomer: unknown,
  requestedAddress: unknown,
): SearchSelection {
  const customerCode =
    typeof requestedCustomer === 'string' ? requestedCustomer.trim() : '';
  const addressCode =
    typeof requestedAddress === 'string' ? requestedAddress.trim() : '';

  if (authMethod === 'session') {
    return {
      allowed: true,
      ...(customerCode ? { customerCode } : {}),
      ...(addressCode ? { addressCode } : {}),
    };
  }

  if (!userContext) return { allowed: true };

  const ownedCustomer = customerCode
    ? userContext.customers.find(
        (customer) => customer.customerCode === customerCode,
      )
    : undefined;

  if (customerCode && !ownedCustomer) return { allowed: false };
  if (
    addressCode &&
    (!ownedCustomer || !ownedCustomer.addressCodes.has(addressCode))
  ) {
    return { allowed: false };
  }

  if (ownedCustomer && addressCode) {
    return {
      allowed: true,
      customerCode: ownedCustomer.customerCode,
      addressCode,
    };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        {
          error: 'Search is not available',
          details: {
            code: 'SOLR_DISABLED',
            message: 'Solr search is not enabled. Set SOLR_ENABLED=true to enable.',
          },
        },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.lang) {
      return NextResponse.json(
        { error: 'Language (lang) is required' },
        { status: 400 }
      );
    }

    // Determine tenant database based on auth method
    const authMethod = request.headers.get('x-auth-method');
    let tenantDb = request.headers.get('x-resolved-tenant-db');
    let hasAuthenticatedUser = false;
    let verifiedUserContext: VerifiedUserContext | null = null;

    // For session auth, verify B2B session and get tenant from session
    if (authMethod === 'session') {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json(
          { error: 'Unauthorized - invalid session' },
          { status: 401 }
        );
      }
      tenantDb = `vinc-${session.tenantId}`;
      hasAuthenticatedUser = true;
    } else if (authMethod === 'api-key') {
      // Verify API key
      const apiKeyResult = await verifyAPIKeyFromRequest(request, 'read');
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || 'Unauthorized' },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
      verifiedUserContext = apiKeyResult.tenantId
        ? await resolveVerifiedUserContext(
            request,
            apiKeyResult.tenantId,
            tenantDb,
          )
        : null;
      hasAuthenticatedUser = verifiedUserContext !== null;
    }

    if (!tenantDb) {
      return NextResponse.json(
        {
          error: 'Tenant not specified',
          details: {
            code: 'NO_TENANT',
            message: 'Tenant must be provided via X-Tenant-ID header or URL path',
          },
        },
        { status: 400 }
      );
    }

    const selection = resolveSearchSelection(
      authMethod,
      verifiedUserContext,
      body.customer_code,
      body.address_code,
    );
    if (!selection.allowed) {
      return NextResponse.json(
        { error: 'Forbidden customer context' },
        { status: 403 },
      );
    }

    // Build search request with defaults
    const config = getSolrConfig();
    const searchRequest: SearchRequest = {
      text: body.text,
      lang: body.lang,
      channel: body.channel, // Sales channel (e.g., "b2c", "b2b")
      start: body.start || 0,
      rows: Math.min(body.rows ?? config.defaultRows, config.maxRows),
      filters: body.filters || {},
      sort: body.sort,
      // Fuzzy search options (like dfl-api)
      fuzzy: body.fuzzy ?? false,
      fuzzy_num: body.fuzzy_num ?? 1,
      include_faceting: body.include_faceting ?? true,
      include_variants: body.include_variants ?? true,
      group_variants: body.group_variants ?? false,
      group: body.group, // Grouping options
      facet_fields: body.facet_fields,
      include_dynamic_blocks: body.include_dynamic_blocks ?? false,
    };

    // Feature 1: resolve per-channel user-attribute exclusions server-side and
    // attach them so buildSearchQuery emits negative fq clauses. Guests / no
    // channel → []. Must run before executeSearchWithFallback.
    searchRequest.user_exclusions = await loadUserExclusionsForSearch(
      tenantDb,
      searchRequest.channel,
      selection.customerCode,
      selection.addressCode,
    );

    // Execute search with tenant-specific core.
    // Falls back to the tenant's default language for full-text matching when
    // the requested language yields no results (sparsely-translated catalogs).
    const { response } = await executeSearchWithFallback(searchRequest, tenantDb);

    // Enrich results with fresh data from MongoDB (channel-aware category resolution)
    const channel = searchRequest.channel;
    const enrichOptions = { include_dynamic_blocks: searchRequest.include_dynamic_blocks };
    if (searchRequest.group_variants) {
      // For variant grouped: fetch parent from MongoDB + enrich all variants
      response.results = await enrichVariantGroupedResults(tenantDb, response.results, searchRequest.lang, channel, enrichOptions);
    } else {
      // Standard enrichment
      response.results = await enrichSearchResults(tenantDb, response.results, searchRequest.lang, channel, enrichOptions);
      response.results = await enrichProductsWithVariants(response.results, searchRequest.lang);
    }

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, searchRequest.lang, tenantDb, channel);
    }

    // Filter packaging/promotions by a server-authorized pricing context.
    const explicitTagFilter = Array.isArray(body.tag_filter)
      ? body.tag_filter
          .filter((tag: unknown): tag is string => typeof tag === 'string')
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];
    let effectiveTags: string[] | null;

    if (authMethod === 'session' && explicitTagFilter.length > 0) {
      // Explicit tag selection is reserved for a verified Suite session.
      effectiveTags = explicitTagFilter;
    } else {
      effectiveTags = await resolveEffectiveTagsForSearch(
        tenantDb, selection.customerCode, selection.addressCode
      );
    }

    if (effectiveTags === null) {
      response.results = stripPackagingFromResults(response.results);
    } else {
      response.results = filterResultsByTags(response.results, effectiveTags);
    }

    // Hard per-element visibility gate. End-user auth comes from a verified
    // Suite session or bearer above, never from body or proxy-header hints.
    response.results = stripNonPublicForGuests(response.results, hasAuthenticatedUser);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error instanceof SolrError) {
      // Parse Solr error details to get the actual error message
      let solrErrorMsg = error.message;
      try {
        const solrErrorJson = JSON.parse(error.details);
        if (solrErrorJson.error?.msg) {
          solrErrorMsg = solrErrorJson.error.msg;
        }
      } catch {
        // details might not be JSON, use as-is
      }

      console.error('[Search API] Solr error:', solrErrorMsg);
      console.error('[Search API] Solr details:', error.details);

      return NextResponse.json(
        {
          error: 'Search query failed',
          details: {
            code: 'SOLR_ERROR',
            message: error.message,
            solr_error: solrErrorMsg,
            statusCode: error.statusCode,
          },
        },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

    console.error('[Search API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: {
          code: 'INTERNAL_ERROR',
          message: (error as Error).message,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/search
 * Search with query parameters (for simple searches)
 *
 * Supports both:
 * - API key authentication (for external clients)
 * - Session authentication (for B2B internal use like mobile-builder)
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        {
          error: 'Search is not available',
          details: {
            code: 'SOLR_DISABLED',
            message: 'Solr search is not enabled. Set SOLR_ENABLED=true to enable.',
          },
        },
        { status: 503 }
      );
    }

    // Determine tenant database based on auth method
    const authMethod = request.headers.get('x-auth-method');
    let tenantDb = request.headers.get('x-resolved-tenant-db');
    let hasAuthenticatedUser = false;
    let verifiedUserContext: VerifiedUserContext | null = null;

    // For session auth, verify B2B session and get tenant from session
    if (authMethod === 'session') {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json(
          { error: 'Unauthorized - invalid session' },
          { status: 401 }
        );
      }
      tenantDb = `vinc-${session.tenantId}`;
      hasAuthenticatedUser = true;
    } else if (authMethod === 'api-key') {
      // Verify API key
      const apiKeyResult = await verifyAPIKeyFromRequest(request, 'read');
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || 'Unauthorized' },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
      verifiedUserContext = apiKeyResult.tenantId
        ? await resolveVerifiedUserContext(
            request,
            apiKeyResult.tenantId,
            tenantDb,
          )
        : null;
      hasAuthenticatedUser = verifiedUserContext !== null;
    }

    if (!tenantDb) {
      return NextResponse.json(
        {
          error: 'Tenant not specified',
          details: {
            code: 'NO_TENANT',
            message: 'Tenant must be provided via X-Tenant-ID header or URL path',
          },
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Extract parameters
    const lang = searchParams.get('lang') || 'it';
    const text = searchParams.get('text') || searchParams.get('q') || undefined;
    const start = parseInt(searchParams.get('start') || '0', 10);
    const rows = parseInt(searchParams.get('rows') || '20', 10);
    const sortField = searchParams.get('sort_field') as NonNullable<SearchRequest['sort']>['field'] | null;
    const sortOrder = searchParams.get('sort_order') as 'asc' | 'desc' | null;

    // Fuzzy search parameters (like dfl-api)
    const fuzzy = searchParams.get('fuzzy') === 'true';
    const fuzzyNum = parseInt(searchParams.get('fuzzy_num') || '1', 10);

    // Grouping parameters
    const groupField = searchParams.get('group_field');
    const groupLimit = searchParams.get('group_limit');
    const groupSort = searchParams.get('group_sort');
    const groupVariants = searchParams.get('group_variants') === 'true';

    // Dynamic blocks flag
    const includeDynamicBlocks = searchParams.get('include_dynamic_blocks') === 'true';

    const selection = resolveSearchSelection(
      authMethod,
      verifiedUserContext,
      searchParams.get('customer_code'),
      searchParams.get('address_code'),
    );
    if (!selection.allowed) {
      return NextResponse.json(
        { error: 'Forbidden customer context' },
        { status: 403 },
      );
    }

    // Build filters from query params
    // Supports multiple formats:
    // - Repeated params: ?filter_brand_id=A&filter_brand_id=B
    // - Comma-separated: ?filter_brand_id=A,B
    // - Array notation: ?filter_brand_id[]=A&filter_brand_id[]=B
    const filters: Record<string, string | string[]> = {};
    const filterPrefix = 'filter_';

    searchParams.forEach((value, key) => {
      if (key.startsWith(filterPrefix)) {
        // Remove [] suffix if present (array notation)
        let filterKey = key.slice(filterPrefix.length);
        if (filterKey.endsWith('[]')) {
          filterKey = filterKey.slice(0, -2);
        }

        // Split comma-separated values
        const values = value.includes(',') ? value.split(',').map(v => v.trim()).filter(Boolean) : [value];

        const existingValue = filters[filterKey];

        if (existingValue) {
          // Multiple values for same filter - merge arrays
          if (Array.isArray(existingValue)) {
            existingValue.push(...values);
          } else {
            filters[filterKey] = [existingValue, ...values];
          }
        } else {
          // Single value or array from comma-separated
          filters[filterKey] = values.length === 1 ? values[0] : values;
        }
      }
    });

    // Build search request
    const config = getSolrConfig();
    const searchRequest: SearchRequest = {
      text,
      lang,
      channel: searchParams.get('channel') || undefined,
      start,
      rows: Math.min(rows, config.maxRows),
      filters,
      sort: sortField
        ? { field: sortField, order: sortOrder || 'desc' }
        : undefined,
      // Fuzzy search options (like dfl-api)
      fuzzy,
      fuzzy_num: fuzzyNum,
      include_faceting: searchParams.get('include_faceting') !== 'false',
      group_variants: groupVariants,
      group: groupField
        ? {
            field: groupField,
            limit: groupLimit ? parseInt(groupLimit, 10) : undefined,
            sort: groupSort || undefined,
          }
        : undefined,
      include_dynamic_blocks: includeDynamicBlocks,
    };

    // Feature 1: per-channel user-attribute exclusions (see POST handler).
    searchRequest.user_exclusions = await loadUserExclusionsForSearch(
      tenantDb,
      searchRequest.channel,
      selection.customerCode,
      selection.addressCode,
    );

    // Build and execute query with tenant-specific Solr collection.
    // Falls back to the tenant's default language for full-text matching when
    // the requested language yields no results (sparsely-translated catalogs).
    const { response } = await executeSearchWithFallback(searchRequest, tenantDb);

    // Enrich results with fresh data from MongoDB (channel-aware category resolution)
    const getChannel = searchRequest.channel;
    const getEnrichOptions = { include_dynamic_blocks: searchRequest.include_dynamic_blocks };
    if (groupVariants) {
      // For variant grouped: fetch parent from MongoDB + enrich all variants
      response.results = await enrichVariantGroupedResults(tenantDb, response.results, lang, getChannel, getEnrichOptions);
    } else {
      // Standard enrichment
      response.results = await enrichSearchResults(tenantDb, response.results, lang, getChannel, getEnrichOptions);
      response.results = await enrichProductsWithVariants(response.results, lang);
    }

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, lang, tenantDb, getChannel);
    }

    // Filter packaging/promotions by a server-authorized pricing context.
    const explicitTagFilter = (searchParams.get('tag_filter') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    let effectiveTags: string[] | null;

    if (authMethod === 'session' && explicitTagFilter.length > 0) {
      // Explicit tag selection is reserved for a verified Suite session.
      effectiveTags = explicitTagFilter;
    } else {
      effectiveTags = await resolveEffectiveTagsForSearch(
        tenantDb, selection.customerCode, selection.addressCode
      );
    }

    if (effectiveTags === null) {
      response.results = stripPackagingFromResults(response.results);
    } else {
      response.results = filterResultsByTags(response.results, effectiveTags);
    }

    // Mirror POST: query flags/customer codes do not establish end-user auth.
    response.results = stripNonPublicForGuests(response.results, hasAuthenticatedUser);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error instanceof SolrError) {
      // Parse Solr error details to get the actual error message
      let solrErrorMsg = error.message;
      try {
        const solrErrorJson = JSON.parse(error.details);
        if (solrErrorJson.error?.msg) {
          solrErrorMsg = solrErrorJson.error.msg;
        }
      } catch {
        // details might not be JSON, use as-is
      }

      console.error('[Search API GET] Solr error:', solrErrorMsg);
      console.error('[Search API GET] Solr details:', error.details);

      return NextResponse.json(
        {
          error: 'Search query failed',
          details: {
            code: 'SOLR_ERROR',
            message: error.message,
            solr_error: solrErrorMsg,
            statusCode: error.statusCode,
          },
        },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

    console.error('[Search API GET] Error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        details: {
          code: 'SEARCH_ERROR',
          message: (error as Error).message,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================
// TAG-BASED FILTERING HELPERS
// ============================================

/**
 * Resolve effective tags for search filtering.
 * Looks up a customer/address by ERP code or internal fallback ID, then
 * resolves effective tags (customer tags + address overrides).
 * Returns null if customer_code/address_code not provided (= strip packaging).
 */
async function resolveEffectiveTagsForSearch(
  tenantDb: string,
  customerCode?: string,
  addressCode?: string,
): Promise<string[] | null> {
  if (!customerCode || !addressCode) return null;

  const { Customer } = await connectWithModels(tenantDb);
  const customer = await Customer.findOne(
    {
      $or: [
        { external_code: customerCode },
        { customer_id: customerCode },
      ],
    },
    { tags: 1, addresses: 1 }
  ).lean();
  if (!customer) return null;

  const address = (customer as any).addresses?.find(
    (a: any) =>
      a.external_code === addressCode || a.address_id === addressCode
  ) || null;

  // A caller must provide an address that belongs to this customer. Falling
  // back to customer-level tags for an unknown address leaks that customer's
  // price tier through a spoofed pair.
  if (!address) return null;

  return resolveEffectiveTags(customer as any, address);
}

/**
 * Strip packaging_options from all results (anonymous search, no customer context).
 */
function stripPackagingFromResults(results: any[]): any[] {
  function stripProduct(product: any): any {
    const { packaging_options, ...rest } = product;
    if (rest.pricing?.tag_filter?.length) {
      delete rest.pricing;
    }
    if (Array.isArray(rest.promotions)) {
      rest.promotions = filterPromotionsForTags(
        rest.promotions,
        new Set<string>(),
      );
    }
    Object.assign(rest, buildPromotionMetadata(rest.promotions, []));
    // Also strip from variants (grouped results)
    if (rest.variants?.length) {
      rest.variants = rest.variants.map((variant: any) => stripProduct(variant));
    }
    return rest;
  }

  return results.map((product: any) => stripProduct(product));
}

/**
 * Filter packaging options and promotions by customer tags.
 * - Packaging with tag_filter: only keep if at least one tag matches
 * - Packaging without tag_filter: always keep (fallback pricing)
 * - Promotions with tag_filter: only keep if at least one tag matches
 * - Promotions without tag_filter: always keep (applies to all)
 */
function filterResultsByTags(results: any[], customerTags: string[]): any[] {
  const tagSet = new Set(customerTags);

  function filterProduct(product: any): any {
    const filteredProductPromotions = Array.isArray(product.promotions)
      ? filterPromotionsForTags(product.promotions, tagSet)
      : product.promotions;
    const topLevelTagFilter = product.pricing?.tag_filter;
    let resolvedPricing =
      !topLevelTagFilter?.length ||
      topLevelTagFilter.some((tag: string) => tagSet.has(tag))
        ? product.pricing
        : undefined;

    if (!product.packaging_options?.length) {
      const filteredProduct =
        resolvedPricing === product.pricing &&
        filteredProductPromotions === product.promotions
        ? product
        : {
            ...product,
            pricing: resolvedPricing,
            promotions: filteredProductPromotions,
          };
      return {
        ...filteredProduct,
        ...buildPromotionMetadata(filteredProductPromotions, []),
      };
    }

    const filteredPackaging = product.packaging_options
      .filter((pkg: any) => {
        const tagFilter = pkg.pricing?.tag_filter;
        if (!tagFilter?.length) return true;
        return tagFilter.some((tag: string) => tagSet.has(tag));
      })
      .map((pkg: any) => {
        if (!pkg.promotions?.length) return pkg;
        const filteredPromos = filterPromotionsForTags(
          pkg.promotions,
          tagSet,
        );
        return { ...pkg, promotions: filteredPromos };
      });

    // Rewrite product-level `pricing` from the matched tier's packaging so the
    // storefront's `product.pricing.list` reflects what the customer actually pays,
    // not the universal default that the sync writes for anonymous browsers.
    if (filteredPackaging.length > 0) {
      const winner =
        filteredPackaging.find((pkg: any) => pkg.is_default) ??
        filteredPackaging.reduce((best: any, pkg: any) =>
          (pkg.qty ?? Infinity) < (best.qty ?? Infinity) ? pkg : best,
        );
      const pp = winner?.pricing;
      if (pp) {
        // Prefer the package-level price (full precision); fall back to unit×qty.
        // Then derive the unit value from list/qty so list_unit shares list's precision
        // instead of being clipped to whatever was stored (e.g. 52.33 vs 52.3325).
        const qty = winner?.qty && winner.qty > 0 ? winner.qty : 1;
        const list   = pp.list   ?? (pp.list_unit   != null ? pp.list_unit   * qty : undefined);
        const retail = pp.retail ?? (pp.retail_unit != null ? pp.retail_unit * qty : undefined);
        const sale   = pp.sale   ?? (pp.sale_unit   != null ? pp.sale_unit   * qty : undefined);

        const { tag_filter: _oldTagFilter, ...basePricing } =
          resolvedPricing ?? {};
        resolvedPricing = {
          ...basePricing,
          ...(list   != null ? { list,   list_unit:   list   / qty } : {}),
          ...(retail != null ? { retail, retail_unit: retail / qty } : {}),
          ...(sale   != null ? { sale,   sale_unit:   sale   / qty } : {}),
          ...(pp.tag_filter != null ? { tag_filter: pp.tag_filter } : {}),
        };
      }
    }

    const filteredProduct = {
      ...product,
      pricing: resolvedPricing,
      promotions: filteredProductPromotions,
      packaging_options: filteredPackaging,
    };
    return {
      ...filteredProduct,
      ...buildPromotionMetadata(
        filteredProductPromotions,
        filteredPackaging,
      ),
    };
  }

  return results.map((product: any) => {
    const filtered = filterProduct(product);
    // Also filter variants (grouped results)
    if (filtered.variants?.length) {
      filtered.variants = filtered.variants.map((v: any) => filterProduct(v));
    }
    return filtered;
  });
}

function filterPromotionsForTags(
  promotions: any[],
  tagSet: ReadonlySet<string>,
): any[] {
  return promotions.filter((promotion: any) => {
    const tagFilter = promotion?.tag_filter;
    if (!Array.isArray(tagFilter) || tagFilter.length === 0) return true;
    return tagFilter.some(
      (tag: unknown) => typeof tag === 'string' && tagSet.has(tag),
    );
  });
}

function buildPromotionMetadata(
  productPromotions: any,
  packagingOptions: any[],
): {
  promo_code: string[];
  promo_codes: string[];
  promo_type: string[];
  has_active_promo: boolean;
} {
  const promotions = [
    ...(Array.isArray(productPromotions) ? productPromotions : []),
    ...packagingOptions.flatMap((packaging: any) =>
      Array.isArray(packaging?.promotions) ? packaging.promotions : [],
    ),
  ];
  const activePromotions = promotions.filter(
    (promotion: any) => promotion?.is_active !== false,
  );
  const promoCodes = Array.from(
    new Set(
      activePromotions
        .map((promotion: any) => promotion?.promo_code)
        .filter(
          (code: unknown): code is string =>
            typeof code === 'string' && code.length > 0,
        ),
    ),
  );
  const promoTypes = Array.from(
    new Set(
      activePromotions
        .map((promotion: any) => promotion?.promo_type)
        .filter(
          (type: unknown): type is string =>
            typeof type === 'string' && type.length > 0,
        ),
    ),
  );

  return {
    promo_code: promoCodes,
    promo_codes: promoCodes,
    promo_type: promoTypes,
    has_active_promo: activePromotions.length > 0,
  };
}
