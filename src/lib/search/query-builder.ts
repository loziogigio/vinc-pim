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
import { getSolrConfig } from '@/config/project.config';
import {
  getMultilingualField,
  getSortField,
  getFilterField,
  getFacetConfig,
  FACET_FIELDS_CONFIG,
  MULTILINGUAL_TEXT_FIELDS,
} from './facet-config';
import { filterSearchStopwords } from './stopwords';

// ============================================
// SEARCH QUERY BUILDER
// ============================================

/**
 * Build a Solr JSON query from a search request
 */
export function buildSearchQuery(request: SearchRequest): SolrJsonQuery {
  const config = getSolrConfig();
  const lang = request.lang || 'it';

  // Build main query with fuzzy options (like dfl-api)
  const query = buildMainQuery(request.text, lang, {
    fuzzy: request.fuzzy,
    fuzzyNum: request.fuzzy_num,
  });

  // Build filter queries
  const filters = buildFilterQueries(request.filters, request);

  // Build sort (pass text to determine default sort behavior)
  const sort = buildSortClause(request.sort, lang, request.text);

  // Pagination
  const offset = request.start || 0;
  const limit = Math.min(request.rows || config.defaultRows, config.maxRows);

  // Build facets if requested
  const facet = request.facet_fields
    ? buildFacetQuery(request.facet_fields)
    : undefined;

  // Build grouping params
  // group_variants: true → auto-group by parent_entity_code with unlimited children (like dfl-api)
  // group: GroupOptions → manual grouping configuration
  let params: Record<string, any> | undefined;
  let isGrouping = false;

  if (request.group_variants) {
    // Auto variant grouping like dfl-api: group by parent_entity_code with all children
    params = buildGroupParams(
      {
        field: 'parent_entity_code',
        limit: -1, // Get ALL variants in each group
        ngroups: true,
      },
      sort
    );
    isGrouping = true;
  } else if (request.group) {
    params = buildGroupParams(request.group, sort);
    isGrouping = true;
  }

  return {
    query,
    filter: filters.length > 0 ? filters : undefined,
    sort: isGrouping ? undefined : sort, // Sort is handled in group params when grouping
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
// SEARCH FIELD CONFIGURATION (inspired by dfl-api)
// ============================================

/**
 * Search fields with their boost weights (higher = more important)
 * Order matters: earlier fields get higher base weight
 *
 * Two types of name/description fields:
 * - _text_{lang}: Tokenized text fields for full-text search (matches terms anywhere)
 * - _sort_{lang}: Lowercase string fields for true "starts with" prefix matching
 */
const SEARCH_FIELDS_CONFIG = [
  // Exact match fields (HIGHEST weight - codes should always come first)
  { field: 'entity_code', weight: 50000, noWildcard: true },
  { field: 'ean', weight: 45000, noWildcard: true },
  { field: 'sku', weight: 40000, wildcardWeight: 30000 }, // Allow prefix matching on SKU
  // Parent codes - find children by parent's code
  { field: 'parent_entity_code', weight: 35000, noWildcard: true },
  { field: 'parent_sku', weight: 30000, wildcardWeight: 20000 },
  // Name sort field - for "starts with" prefix matching (NOT stemmed)
  { field: 'name_sort_{lang}', weight: 0, wildcardWeight: 10000, noExact: true, noContains: true },
  // Name tokenized text - HIGH PRIORITY (but lower than codes)
  { field: 'name_text_{lang}', weight: 5000, wildcardWeight: 2000, containsWeight: 800 },
  // Synonym terms for enhanced search (500 = less than name_text_ 5000, but high priority)
  { field: 'synonym_terms_text_{lang}', weight: 4500, wildcardWeight: 1800, containsWeight: 600 }, // Synonym dictionary terms
  // Brand/Model (medium weight)
  { field: 'brand_label', weight: 200, wildcardWeight: 80 },
  { field: 'product_model', weight: 150, wildcardWeight: 50 },
  // Short description sort - LOW (avoid double boost)
  { field: 'short_description_sort_{lang}', weight: 0, wildcardWeight: 50, noExact: true, noContains: true },
  // Short description text - VERY LOW weight (avoid double boost with name)
  { field: 'short_description_text_{lang}', weight: 20, wildcardWeight: 8, containsWeight: 3 },
  // Description sort - LOW
  { field: 'description_sort_{lang}', weight: 0, wildcardWeight: 30, noExact: true, noContains: true },
  // Description tokenized text - LOW weight
  { field: 'description_text_{lang}', weight: 20, wildcardWeight: 8, containsWeight: 3 },
  // Features (lower weight)
  { field: 'features_text_{lang}', weight: 30, wildcardWeight: 10 },
  // Attribute labels and values (searchable dynamic attributes)
  { field: 'attr_values_text_{lang}', weight: 80, wildcardWeight: 30 }, // Attribute values (CROMATO, PEGASO, NT300)
  { field: 'attr_labels_text_{lang}', weight: 25, wildcardWeight: 8 },  // Attribute labels (Colore, Materiale)
  // Specification labels and values
  { field: 'spec_labels_text_{lang}', weight: 20, wildcardWeight: 6 },
  { field: 'spec_values_text_{lang}', weight: 60, wildcardWeight: 20, containsWeight: 8 }, // Spec values (5kg, 100cm, 12000 BTU)
  // Category/Collection/Product Type names
  { field: 'category_name_text_{lang}', weight: 40, wildcardWeight: 12 },
  { field: 'collection_names_text_{lang}', weight: 15, wildcardWeight: 5 },
  { field: 'product_type_name_text_{lang}', weight: 20, wildcardWeight: 6 },
  // Meta fields (SEO)
  { field: 'meta_title_text_{lang}', weight: 35, wildcardWeight: 10 },
  { field: 'meta_description_text_{lang}', weight: 15, wildcardWeight: 5 },
  { field: 'meta_keywords_text_{lang}', weight: 20, wildcardWeight: 8 },
  // Tag names
  { field: 'tag_names_text_{lang}', weight: 10, wildcardWeight: 3 },
];

// ============================================
// MAIN QUERY BUILDER
// ============================================

/**
 * Build the main query clause with boosting (like dfl-api)
 * Features:
 * - Field-based boosting (name fields weighted highest)
 * - Term position boosting (earlier terms get higher boost)
 * - Wildcard patterns: term*, *term*
 * - Fuzzy search support (optional)
 * - Stopword filtering: common articles/prepositions that Solr removes
 *   at index time are stripped from non-last positions so they don't
 *   block results. The last term is always kept (prefix typing support).
 */
function buildMainQuery(
  text: string | undefined,
  lang: string,
  options?: { fuzzy?: boolean; fuzzyNum?: number }
): string {
  // IMAGE COUNT BOOST - applied to ALL searches (text and free browse)
  // Products with images rank higher as a tie-breaker
  const imageBoost = [
    '(image_count:[1 TO 2]^5000)',   // 1-2 images: +5000
    '(image_count:[2 TO 4]^5500)',   // 2-4 images: +5500
    '(image_count:[5 TO *]^6000)',   // 5+ images: +6000
  ].join(' ');

  if (!text || text.trim() === '') {
    // Free search (no text) - just match all with image boost
    return `*:* ${imageBoost}`;
  }

  // Split into terms, then filter stopwords from all positions.
  // Stopwords (per, di, il, …) are removed by Solr at index time,
  // so requiring them in the query would return zero results.
  const rawTerms = text.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (rawTerms.length === 0) {
    return '*:*';
  }

  const searchTerms = filterSearchStopwords(rawTerms, lang);
  const numTerms = searchTerms.length;
  const fuzzy = options?.fuzzy ?? false;
  const fuzzyNum = options?.fuzzyNum ?? 1;

  // Build query for each term
  const termQueries: string[] = [];

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = escapeQueryChars(searchTerms[termIndex]);
    const termBoost = getTermPositionBoost(termIndex, numTerms);

    const fieldQueries: string[] = [];

    for (const fieldConfig of SEARCH_FIELDS_CONFIG) {
      // Replace {lang} placeholder with actual language
      const solrField = fieldConfig.field.replace('{lang}', lang);

      // 1. Exact/Fuzzy match (highest weight for this field)
      // Skip if noExact is set (for sort fields used only for prefix matching)
      if (fieldConfig.weight > 0 && !(fieldConfig as any).noExact) {
        if (fuzzy && !fieldConfig.noWildcard) {
          fieldQueries.push(`${solrField}:${term}~${fuzzyNum}^${fieldConfig.weight}`);
        } else {
          fieldQueries.push(`${solrField}:${term}^${fieldConfig.weight}`);
        }
        // For brand_label, also try UPPERCASE (brand field is case-sensitive)
        if (solrField === 'brand_label') {
          fieldQueries.push(`${solrField}:${term.toUpperCase()}^${fieldConfig.weight}`);
        }
      }

      // 2. Prefix wildcard: term* (medium weight)
      if (fieldConfig.wildcardWeight && fieldConfig.wildcardWeight > 0 && !fieldConfig.noWildcard) {
        fieldQueries.push(`${solrField}:${term}*^${fieldConfig.wildcardWeight}`);
      }

      // 3. Contains wildcard: *term* (lower weight)
      // Skip if noContains is set (for sort fields - contains doesn't work on string fields)
      if (fieldConfig.containsWeight && fieldConfig.containsWeight > 0 && !fieldConfig.noWildcard && !(fieldConfig as any).noContains) {
        fieldQueries.push(`${solrField}:*${term}*^${fieldConfig.containsWeight}`);
      }
    }

    // Combine all field queries for this term with OR, apply term boost
    const termQuery = `((${fieldQueries.join(' ')})^${termBoost})`;

    // All terms are REQUIRED (AND logic) - use + prefix
    termQueries.push(`+${termQuery}`);
  }

  // Add POSITION BOOST - each term appearing EARLY in name gets boost
  // For "vaso wc sospeso geberit": terms can be in name/brand/description
  // But products with terms early in NAME rank highest
  for (const term of searchTerms) {
    const escapedTerm = escapeQueryChars(term);
    // Term appears in first 25 chars of name → high boost
    termQueries.push(`(name_sort_${lang}:/.{0,25}${escapedTerm}.*/^500000)`);
  }

  // Add PHRASE BOOST for consecutive terms in name (2-term combinations)
  // Use rawTerms (before stopword filtering) so the original phrase
  // "macchina per caffè" still boosts products with that exact sequence.
  if (rawTerms.length >= 2) {
    for (let i = 0; i < rawTerms.length - 1; i++) {
      const pair = `${rawTerms[i]} ${rawTerms[i + 1]}`;
      // Exact pair in name (not stemmed)
      termQueries.push(`(name_sort_${lang}:/.*${pair}.*/^1000000)`);
      // Pair early in name
      termQueries.push(`(name_sort_${lang}:/.{0,20}${pair}.*/^2000000)`);
    }
  }

  // Add image boost (same as free search)
  termQueries.push(imageBoost);

  return termQueries.join(' ');
}

/**
 * Calculate boost factor based on term position (earlier terms get higher boost)
 * Based on dfl-api get_boost_from_array_position
 */
function getTermPositionBoost(position: number, totalTerms: number): number {
  if (totalTerms <= 1) {
    return 1;
  }
  // Earlier terms get higher boost: 1.5 * (numTerms - position)
  return 1.5 * (totalTerms - position);
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
 * Check if a value is a wildcard pattern (starts or ends with *)
 */
function isWildcardPattern(value: string): boolean {
  return value.startsWith('*') || value.endsWith('*');
}

/**
 * Escape query characters but preserve wildcards in wildcard patterns
 */
function escapeFilterValue(value: string): string {
  if (isWildcardPattern(value)) {
    // For wildcard patterns, only escape chars that aren't wildcards
    const specialCharsNoWildcard = /[+\-&|!(){}[\]^"~?:\\/]/g;
    return value.replace(specialCharsNoWildcard, '\\$&');
  }
  return escapeQueryChars(value);
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
    // Don't quote wildcard patterns as quotes disable wildcard matching
    if (isWildcardPattern(value)) {
      return `${field}:${escapeFilterValue(value)}`;
    }
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
      if (isWildcardPattern(v)) {
        return escapeFilterValue(v);
      }
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
 * When no explicit sort is provided:
 * - If text search: default to relevance (score desc)
 * - If no text (browsing/filtering only): default to item_creation_date desc (ERP insertion date)
 */
function buildSortClause(
  sort: SearchRequest['sort'],
  lang: string,
  text?: string
): string | undefined {
  if (!sort) {
    // No explicit sort - use smart defaults
    if (!text || text.trim() === '') {
      // No text query (browsing/filtering) → sort by ERP insertion date (newest first)
      return 'item_creation_date desc';
    }
    // Text search → sort by relevance
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
 * Supports static facets from FACET_FIELDS_CONFIG and dynamic spec_* / attribute_* facets
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
    // Use getFacetConfig to handle both static and dynamic fields
    const fieldConfig = getFacetConfig(field);

    if (fieldConfig?.type === 'range' && fieldConfig.ranges) {
      // Range facets use query facets
      facet[field] = buildRangeFacet(field, fieldConfig.ranges);
    } else {
      // Terms facet (works for flat, boolean, hierarchical, and dynamic fields)
      const solrField = getFilterField(field);
      const facetDef: SolrJsonFacetField = {
        type: 'terms',
        field: solrField,
        limit: limit || config.facetLimit,
        mincount: mincount || config.facetMinCount,
        sort: sort || 'count',
      };

      // Exclude empty/null values for specific fields
      const excludeEmptyFields = ['product_type_code', 'product_type_id', 'brand_id', 'category_id'];
      if (excludeEmptyFields.includes(field)) {
        facetDef.domain = { filter: `${solrField}:*` };
      }

      facet[field] = facetDef;
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

  // Sort (pass text to determine default sort behavior)
  const sort = buildSortClause(request.sort, lang, request.text);
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
