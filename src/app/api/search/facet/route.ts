/**
 * POST /api/search/facet
 * Get available facet values with counts based on current filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSolrClient, SolrError } from '@/lib/search/solr-client';
import { buildFacetOnlyQuery } from '@/lib/search/query-builder';
import { transformFacetResponse } from '@/lib/search/response-transformer';
import { FacetRequest } from '@/lib/types/search';
import { getSolrConfig, isSolrEnabled } from '@/config/project.config';
import { DEFAULT_FACET_FIELDS } from '@/lib/search/facet-config';

export async function POST(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        {
          error: 'Faceting is not available',
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

    // Get tenant-specific Solr collection from headers (set by middleware)
    const tenantDb = request.headers.get('x-resolved-tenant-db');
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

    // Use default facet fields if not specified
    const facetFields = body.facet_fields && body.facet_fields.length > 0
      ? body.facet_fields
      : DEFAULT_FACET_FIELDS;

    // Build facet request with defaults
    const config = getSolrConfig();
    const facetRequest: FacetRequest = {
      lang: body.lang,
      filters: body.filters || {},
      text: body.text,
      facet_fields: facetFields,
      facet_limit: body.facet_limit || config.facetLimit,
      facet_mincount: body.facet_mincount || config.facetMinCount,
      facet_sort: body.facet_sort || 'count',
    };

    // Build Solr query (facet-only, no docs)
    const solrQuery = buildFacetOnlyQuery(facetRequest);

    // Execute search with tenant-specific core
    const { SolrClient } = await import('@/lib/search/solr-client');
    const solrClient = new SolrClient(config.url, tenantDb);
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response
    const response = transformFacetResponse(solrResponse, facetRequest.lang);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Facet error:', error);

    if (error instanceof SolrError) {
      return NextResponse.json(
        {
          error: 'Facet query failed',
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
 * GET /api/search/facet
 * Get facets with query parameters
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        {
          error: 'Faceting is not available',
          details: {
            code: 'SOLR_DISABLED',
            message: 'Solr search is not enabled. Set SOLR_ENABLED=true to enable.',
          },
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Get tenant-specific Solr collection from headers (set by middleware)
    const tenantDb = request.headers.get('x-resolved-tenant-db');
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

    // Extract parameters
    const lang = searchParams.get('lang') || 'it';
    const text = searchParams.get('text') || searchParams.get('q') || undefined;
    const facetFieldsParam = searchParams.get('facet_fields');
    const facetFields = facetFieldsParam
      ? facetFieldsParam.split(',').map((f) => f.trim())
      : DEFAULT_FACET_FIELDS;

    // Build filters from query params
    const filters: Record<string, string | string[]> = {};
    const filterPrefix = 'filter_';

    searchParams.forEach((value, key) => {
      if (key.startsWith(filterPrefix)) {
        const filterKey = key.slice(filterPrefix.length);
        const existingValue = filters[filterKey];

        if (existingValue) {
          if (Array.isArray(existingValue)) {
            existingValue.push(value);
          } else {
            filters[filterKey] = [existingValue, value];
          }
        } else {
          filters[filterKey] = value;
        }
      }
    });

    // Build facet request
    const config = getSolrConfig();
    const facetRequest: FacetRequest = {
      lang,
      filters,
      text,
      facet_fields: facetFields,
      facet_limit: parseInt(searchParams.get('facet_limit') || String(config.facetLimit), 10),
      facet_mincount: parseInt(searchParams.get('facet_mincount') || String(config.facetMinCount), 10),
      facet_sort: (searchParams.get('facet_sort') as 'count' | 'index') || 'count',
    };

    // Build and execute query with tenant-specific core
    const solrQuery = buildFacetOnlyQuery(facetRequest);
    const { SolrClient } = await import('@/lib/search/solr-client');
    const solrClient = new SolrClient(config.url, tenantDb);
    const solrResponse = await solrClient.search(solrQuery);

    // Transform response
    const response = transformFacetResponse(solrResponse, lang);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Facet error:', error);

    return NextResponse.json(
      {
        error: 'Facet query failed',
        details: {
          code: 'FACET_ERROR',
          message: (error as Error).message,
        },
      },
      { status: 500 }
    );
  }
}
