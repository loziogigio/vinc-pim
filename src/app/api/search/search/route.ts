/**
 * POST /api/search/search
 * Search products with filters, pagination, and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSolrClient, SolrError } from '@/lib/search/solr-client';
import { buildSearchQuery } from '@/lib/search/query-builder';
import { transformSearchResponse, enrichFacetResults } from '@/lib/search/response-transformer';
import { enrichSearchResults } from '@/lib/search/response-enricher';
import { SearchRequest } from '@/lib/types/search';
import { getSolrConfig, isSolrEnabled } from '@/lib/search/facet-config';

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

    // Build search request with defaults
    const config = getSolrConfig();
    const searchRequest: SearchRequest = {
      text: body.text,
      lang: body.lang,
      start: body.start || 0,
      rows: Math.min(body.rows || config.defaultRows, config.maxRows),
      filters: body.filters || {},
      sort: body.sort,
      include_faceting: body.include_faceting ?? true,
      include_variants: body.include_variants ?? true,
      group_variants: body.group_variants ?? false,
      group: body.group, // Grouping options
      facet_fields: body.facet_fields,
    };

    // Build Solr query
    const solrQuery = buildSearchQuery(searchRequest);

    // Execute search
    const solrClient = getSolrClient();
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response (pass group field if grouping is enabled)
    const response = transformSearchResponse(
      solrResponse,
      searchRequest.lang,
      searchRequest.group?.field
    );

    // Enrich results with fresh data from MongoDB (brands, etc.)
    response.results = await enrichSearchResults(response.results, searchRequest.lang);

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, searchRequest.lang);
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Search error:', error);

    if (error instanceof SolrError) {
      return NextResponse.json(
        {
          error: 'Search query failed',
          details: {
            code: 'SOLR_ERROR',
            message: error.message,
            statusCode: error.statusCode,
          },
        },
        { status: error.statusCode >= 400 ? error.statusCode : 500 }
      );
    }

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

    const { searchParams } = new URL(request.url);

    // Extract parameters
    const lang = searchParams.get('lang') || 'it';
    const text = searchParams.get('text') || searchParams.get('q') || undefined;
    const start = parseInt(searchParams.get('start') || '0', 10);
    const rows = parseInt(searchParams.get('rows') || '20', 10);
    const sortField = searchParams.get('sort_field') as SearchRequest['sort']['field'] | null;
    const sortOrder = searchParams.get('sort_order') as 'asc' | 'desc' | null;

    // Grouping parameters
    const groupField = searchParams.get('group_field');
    const groupLimit = searchParams.get('group_limit');
    const groupSort = searchParams.get('group_sort');

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
      include_faceting: searchParams.get('include_faceting') !== 'false',
      group: groupField
        ? {
            field: groupField,
            limit: groupLimit ? parseInt(groupLimit, 10) : undefined,
            sort: groupSort || undefined,
          }
        : undefined,
    };

    // Build and execute query
    const solrQuery = buildSearchQuery(searchRequest);
    const solrClient = getSolrClient();
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response
    const response = transformSearchResponse(solrResponse, lang, groupField || undefined);

    // Enrich results with fresh data from MongoDB (brands, etc.)
    response.results = await enrichSearchResults(response.results, lang);

    // Enrich facets with full entity data
    if (response.facet_results) {
      response.facet_results = await enrichFacetResults(response.facet_results, lang);
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Search error:', error);

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
