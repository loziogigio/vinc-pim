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
import { buildSearchQuery } from '@/lib/search/query-builder';
import { transformSearchResponse, enrichFacetResults, enrichProductsWithVariants } from '@/lib/search/response-transformer';
import { enrichSearchResults, enrichVariantGroupedResults } from '@/lib/search/response-enricher';
import { SearchRequest } from '@/lib/types/search';
import { getSolrConfig, isSolrEnabled } from '@/config/project.config';
import { getB2BSession } from '@/lib/auth/b2b-session';
import { verifyAPIKeyFromRequest } from '@/lib/auth/api-key-auth';
import { connectWithModels } from '@/lib/db/connection';
import { resolveEffectiveTags } from '@/lib/services/tag-pricing.service';

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

    // Build search request with defaults
    const config = getSolrConfig();
    const searchRequest: SearchRequest = {
      text: body.text,
      lang: body.lang,
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
    };

    // Build Solr query
    const solrQuery = buildSearchQuery(searchRequest);

    // Execute search with tenant-specific core
    const { SolrClient } = await import('@/lib/search/solr-client');
    const solrClient = new SolrClient(config.url, tenantDb);
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response (pass group field if grouping is enabled)
    // group_variants: true → uses parent_entity_code grouping with variant structure
    const groupField = searchRequest.group_variants
      ? 'parent_entity_code'
      : searchRequest.group?.field;

    const response = transformSearchResponse(
      solrResponse,
      searchRequest.lang,
      groupField,
      searchRequest.group_variants
    );

    // Enrich results with fresh data from MongoDB
    if (searchRequest.group_variants) {
      // For variant grouped: fetch parent from MongoDB + enrich all variants
      response.results = await enrichVariantGroupedResults(tenantDb, response.results, searchRequest.lang);
    } else {
      // Standard enrichment
      response.results = await enrichSearchResults(tenantDb, response.results, searchRequest.lang);
      response.results = await enrichProductsWithVariants(response.results, searchRequest.lang);
    }

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, searchRequest.lang, tenantDb);
    }

    // Filter packaging/promotions by effective customer+address tags
    const effectiveTags = await resolveEffectiveTagsForSearch(
      tenantDb, body.customer_code, body.address_code
    );
    if (effectiveTags === null) {
      response.results = stripPackagingFromResults(response.results);
    } else if (effectiveTags.length) {
      response.results = filterResultsByTags(response.results, effectiveTags);
    }

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
    };

    // Build and execute query with tenant-specific Solr collection
    const solrQuery = buildSearchQuery(searchRequest);
    const { SolrClient } = await import('@/lib/search/solr-client');
    const solrClient = new SolrClient(config.url, tenantDb);
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response
    // group_variants: true → uses parent_entity_code grouping with variant structure
    const effectiveGroupField = groupVariants
      ? 'parent_entity_code'
      : groupField || undefined;

    const response = transformSearchResponse(
      solrResponse,
      lang,
      effectiveGroupField,
      groupVariants
    );

    // Enrich results with fresh data from MongoDB
    if (groupVariants) {
      // For variant grouped: fetch parent from MongoDB + enrich all variants
      response.results = await enrichVariantGroupedResults(tenantDb, response.results, lang);
    } else {
      // Standard enrichment
      response.results = await enrichSearchResults(tenantDb, response.results, lang);
      response.results = await enrichProductsWithVariants(response.results, lang);
    }

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, lang, tenantDb);
    }

    // Filter packaging/promotions by effective customer+address tags
    const customerCode = searchParams.get('customer_code') || undefined;
    const addressCode = searchParams.get('address_code') || undefined;
    const effectiveTags = await resolveEffectiveTagsForSearch(
      tenantDb, customerCode, addressCode
    );
    if (effectiveTags === null) {
      response.results = stripPackagingFromResults(response.results);
    } else if (effectiveTags.length) {
      response.results = filterResultsByTags(response.results, effectiveTags);
    }

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
 * Looks up customer by external_code, finds address by external_code,
 * then resolves effective tags (customer tags + address overrides).
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
    { external_code: customerCode },
    { tags: 1, addresses: 1 }
  ).lean();
  if (!customer) return null;

  const address = (customer as any).addresses?.find(
    (a: any) => a.external_code === addressCode
  ) || null;

  return resolveEffectiveTags(customer as any, address);
}

/**
 * Strip packaging_options from all results (anonymous search, no customer context).
 */
function stripPackagingFromResults(results: any[]): any[] {
  return results.map((product: any) => {
    const { packaging_options, ...rest } = product;
    // Also strip from variants (grouped results)
    if (rest.variants?.length) {
      rest.variants = rest.variants.map((v: any) => {
        const { packaging_options: _, ...vRest } = v;
        return vRest;
      });
    }
    return rest;
  });
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
    if (!product.packaging_options?.length) return product;

    const filteredPackaging = product.packaging_options
      .filter((pkg: any) => {
        const tagFilter = pkg.pricing?.tag_filter;
        if (!tagFilter?.length) return true;
        return tagFilter.some((tag: string) => tagSet.has(tag));
      })
      .map((pkg: any) => {
        if (!pkg.promotions?.length) return pkg;
        const filteredPromos = pkg.promotions.filter((promo: any) => {
          if (!promo.tag_filter?.length) return true;
          return promo.tag_filter.some((tag: string) => tagSet.has(tag));
        });
        return { ...pkg, promotions: filteredPromos };
      });

    return { ...product, packaging_options: filteredPackaging };
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
