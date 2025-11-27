/**
 * Solr Query Builder
 * Builds Solr queries from search/facet requests
 */

import { SolrJsonQuery, SolrJsonFacet, SolrJsonFacetField } from './solr-client';
import {
  SearchRequest,
  FacetRequest,
  SearchFilters,
  GroupOptions,
} from '@/lib/types/search';
import {
  getSolrConfig,
  getMultilingualField,
  getSortField,
  getFilterField,
  FACET_FIELDS_CONFIG,
  MULTILINGUAL_TEXT_FIELDS,
} from './facet-config';

// ============================================
// SEARCH QUERY BUILDER
// ============================================

/**
 * Build a Solr JSON query from a search request
 */
export function buildSearchQuery(request: SearchRequest): SolrJsonQuery {
  const config = getSolrConfig();
  const lang = request.lang || 'it';

  // Build main query
  const query = buildMainQuery(request.text, lang);

  // Build filter queries
  const filters = buildFilterQueries(request.filters, request);

  // Build sort
  const sort = buildSortClause(request.sort, lang);

  // Pagination
  const offset = request.start || 0;
  const limit = Math.min(request.rows || config.defaultRows, config.maxRows);

  // Build facets if requested
  const facet = request.facet_fields
    ? buildFacetQuery(request.facet_fields)
    : undefined;

  // Build grouping params if requested
  const params = request.group
    ? buildGroupParams(request.group, sort)
    : undefined;

  return {
    query,
    filter: filters.length > 0 ? filters : undefined,
    sort: request.group ? undefined : sort, // Sort is handled in group params when grouping
    offset,
    limit,
    fields: '*',
    facet,
    params,
  };
}

/**
 * Build grouping parameters for Solr
 */
function buildGroupParams(
  group: GroupOptions,
  globalSort?: string
): Record<string, any> {
  const params: Record<string, any> = {
    group: true,
    'group.field': group.field,
    'group.limit': group.limit ?? 3,
    'group.ngroups': group.ngroups ?? true,
  };

  // Sort within groups
  if (group.sort) {
    params['group.sort'] = group.sort;
  } else if (globalSort) {
    // Use global sort as group sort if not specified
    params['group.sort'] = globalSort;
  }

  // Return results in flat format (like normal search)
  if (group.main) {
    params['group.main'] = true;
  }

  // Truncate facet counts to match grouped results
  if (group.truncate !== false) {
    params['group.truncate'] = true;
  }

  return params;
}

/**
 * Build a Solr JSON query for facet-only requests
 */
export function buildFacetOnlyQuery(request: FacetRequest): SolrJsonQuery {
  const lang = request.lang || 'it';

  // Use match-all query unless text search provided
  const query = request.text
    ? buildMainQuery(request.text, lang)
    : '*:*';

  // Build filter queries
  const filters = buildFilterQueries(request.filters);

  // Build facet query
  const facet = buildFacetQuery(
    request.facet_fields,
    request.facet_limit,
    request.facet_mincount,
    request.facet_sort
  );

  return {
    query,
    filter: filters.length > 0 ? filters : undefined,
    offset: 0,
    limit: 0, // No docs needed, just facets
    facet,
  };
}

// ============================================
// MAIN QUERY BUILDER
// ============================================

/**
 * Build the main query clause
 */
function buildMainQuery(text: string | undefined, lang: string): string {
  if (!text || text.trim() === '') {
    return '*:*';
  }

  const searchText = escapeQueryChars(text.trim());
  const searchTerms = searchText.split(/\s+/).filter(Boolean);

  // Build query across multilingual text fields
  const searchFields = [
    'name',
    'description',
    'short_description',
    'features',
    'sku',
  ];

  const clauses: string[] = [];

  for (const field of searchFields) {
    const solrField = MULTILINGUAL_TEXT_FIELDS.includes(field)
      ? `${field}_text_${lang}`
      : field;

    // Match all terms (AND) or any term (OR)
    const termClauses = searchTerms.map((term) => `${solrField}:*${term}*`);
    clauses.push(`(${termClauses.join(' AND ')})`);
  }

  // Also search in entity_code and ean for exact matches
  clauses.push(`entity_code:${searchText}`);
  clauses.push(`ean:${searchText}`);

  return clauses.join(' OR ');
}

/**
 * Escape special Solr query characters
 */
function escapeQueryChars(text: string): string {
  const specialChars = /[+\-&|!(){}[\]^"~*?:\\/]/g;
  return text.replace(specialChars, '\\$&');
}

// ============================================
// FILTER QUERY BUILDER
// ============================================

/**
 * Build filter query array from filters object
 */
function buildFilterQueries(
  filters?: SearchFilters,
  request?: SearchRequest
): string[] {
  const fq: string[] = [];

  // Add default filters
  if (request?.include_faceting !== false) {
    fq.push('include_faceting:true');
  }

  if (!filters) {
    return fq;
  }

  // Process each filter
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    // Handle range filters specially
    if (key === 'price_min' || key === 'price_max') {
      continue; // Handled separately
    }

    const solrField = getFilterField(key);
    const filterClause = buildFilterClause(solrField, value);

    if (filterClause) {
      fq.push(filterClause);
    }
  }

  // Handle price range
  if (filters.price_min !== undefined || filters.price_max !== undefined) {
    const priceFilter = buildRangeFilter(
      'price',
      filters.price_min,
      filters.price_max
    );
    if (priceFilter) {
      fq.push(priceFilter);
    }
  }

  return fq;
}

/**
 * Build a single filter clause
 */
function buildFilterClause(
  field: string,
  value: string | string[] | number | boolean
): string | null {
  if (typeof value === 'boolean') {
    return `${field}:${value}`;
  }

  if (typeof value === 'number') {
    return `${field}:${value}`;
  }

  if (typeof value === 'string') {
    if (value.includes(' ') || value.includes(':')) {
      return `${field}:"${escapeQueryChars(value)}"`;
    }
    return `${field}:${escapeQueryChars(value)}`;
  }

  if (Array.isArray(value) && value.length > 0) {
    if (value.length === 1) {
      return buildFilterClause(field, value[0]);
    }
    const escapedValues = value.map((v) => {
      if (v.includes(' ') || v.includes(':')) {
        return `"${escapeQueryChars(v)}"`;
      }
      return escapeQueryChars(v);
    });
    return `${field}:(${escapedValues.join(' OR ')})`;
  }

  return null;
}

/**
 * Build a range filter clause
 */
function buildRangeFilter(
  field: string,
  min?: number,
  max?: number
): string | null {
  if (min === undefined && max === undefined) {
    return null;
  }

  const minVal = min !== undefined ? min : '*';
  const maxVal = max !== undefined ? max : '*';

  return `${field}:[${minVal} TO ${maxVal}]`;
}

// ============================================
// SORT BUILDER
// ============================================

/**
 * Build sort clause
 */
function buildSortClause(
  sort: SearchRequest['sort'],
  lang: string
): string | undefined {
  if (!sort) {
    // Default sort: relevance (score) desc
    return 'score desc';
  }

  const solrField = getSortField(sort.field, lang);
  return `${solrField} ${sort.order}`;
}

// ============================================
// FACET QUERY BUILDER
// ============================================

/**
 * Build facet query object
 */
function buildFacetQuery(
  facetFields: string[],
  limit?: number,
  mincount?: number,
  sort?: 'count' | 'index'
): SolrJsonFacet {
  const config = getSolrConfig();
  const facet: SolrJsonFacet = {};

  for (const field of facetFields) {
    const fieldConfig = FACET_FIELDS_CONFIG[field];

    if (fieldConfig?.type === 'range' && fieldConfig.ranges) {
      // Range facets use query facets
      facet[field] = buildRangeFacet(field, fieldConfig.ranges);
    } else {
      // Terms facet
      facet[field] = {
        type: 'terms',
        field: getFilterField(field),
        limit: limit || config.facetLimit,
        mincount: mincount || config.facetMinCount,
        sort: sort || 'count',
      } as SolrJsonFacetField;
    }
  }

  return facet;
}

/**
 * Build range facet using nested queries
 */
function buildRangeFacet(
  field: string,
  ranges: { from?: number; to?: number; label: string }[]
): SolrJsonFacetField {
  const solrField = getFilterField(field);

  // For JSON facet API, we'll use range type
  return {
    type: 'range',
    field: solrField,
    start: ranges[0]?.from || 0,
    end: ranges[ranges.length - 1]?.to || 10000,
    gap: calculateGap(ranges),
  } as SolrJsonFacetField;
}

/**
 * Calculate gap for range facet
 */
function calculateGap(ranges: { from?: number; to?: number }[]): number {
  // Use the first range's size as gap, or default to 100
  if (ranges.length > 0 && ranges[0].from !== undefined && ranges[0].to !== undefined) {
    return ranges[0].to - ranges[0].from;
  }
  return 100;
}

// ============================================
// LEGACY QUERY PARAMETER BUILDER
// ============================================

/**
 * Build query parameters for legacy Solr API
 * (Used when JSON API is not available)
 */
export function buildQueryParams(request: SearchRequest): Record<string, string | string[]> {
  const config = getSolrConfig();
  const lang = request.lang || 'it';
  const params: Record<string, string | string[]> = {};

  // Main query
  params.q = buildMainQuery(request.text, lang);

  // Filter queries
  const fq = buildFilterQueries(request.filters, request);
  if (fq.length > 0) {
    params.fq = fq;
  }

  // Sort
  const sort = buildSortClause(request.sort, lang);
  if (sort) {
    params.sort = sort;
  }

  // Pagination
  params.start = String(request.start || 0);
  params.rows = String(Math.min(request.rows || config.defaultRows, config.maxRows));

  // Facets
  if (request.facet_fields && request.facet_fields.length > 0) {
    params.facet = 'true';
    params['facet.field'] = request.facet_fields.map(getFilterField);
    params['facet.limit'] = String(config.facetLimit);
    params['facet.mincount'] = String(config.facetMinCount);
  }

  return params;
}
