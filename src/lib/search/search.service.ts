/**
 * Search Service
 * Core search function for direct use (no HTTP overhead)
 */

import { getSolrClient, SolrError } from './solr-client';
import { buildSearchQuery } from './query-builder';
import { transformSearchResponse, enrichFacetResults } from './response-transformer';
import { enrichSearchResults } from './response-enricher';
import { SearchRequest, SearchResponse } from '@/lib/types/search';
import { getSolrConfig, isSolrEnabled } from '@/config/project.config';

export { SolrError };

export interface SearchParams {
  text?: string;
  lang: string;
  start?: number;
  rows?: number;
  filters?: Record<string, string | string[]>;
  sort?: SearchRequest['sort'];
  fuzzy?: boolean;
  fuzzy_num?: number;
  include_faceting?: boolean;
  include_variants?: boolean;
  group_variants?: boolean;
  group?: SearchRequest['group'];
  facet_fields?: string[];
}

export interface SearchResult {
  success: true;
  data: SearchResponse;
}

/**
 * Execute product search directly via Solr
 * Use this instead of calling /api/search/search via HTTP
 */
export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  if (!isSolrEnabled()) {
    throw new Error('Solr search is not enabled. Set SOLR_ENABLED=true to enable.');
  }

  const config = getSolrConfig();

  const searchRequest: SearchRequest = {
    text: params.text,
    lang: params.lang,
    start: params.start || 0,
    rows: Math.min(params.rows || config.defaultRows, config.maxRows),
    filters: params.filters || {},
    sort: params.sort,
    fuzzy: params.fuzzy ?? false,
    fuzzy_num: params.fuzzy_num ?? 1,
    include_faceting: params.include_faceting ?? true,
    include_variants: params.include_variants ?? true,
    group_variants: params.group_variants ?? false,
    group: params.group,
    facet_fields: params.facet_fields,
  };

  // Build and execute query
  const solrQuery = buildSearchQuery(searchRequest);
  const solrClient = getSolrClient();
  const solrResponse = await solrClient.search(solrQuery);

  // Transform response
  const response = transformSearchResponse(
    solrResponse,
    searchRequest.lang,
    searchRequest.group?.field
  );

  // Enrich results with fresh data from MongoDB
  response.results = await enrichSearchResults(response.results, searchRequest.lang);

  // Enrich facets with full entity data
  if (response.facet_results) {
    response.facet_results = await enrichFacetResults(response.facet_results, searchRequest.lang);
  }

  return {
    success: true,
    data: response,
  };
}
