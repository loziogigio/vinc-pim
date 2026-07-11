/**
 * Search execution with language fallback.
 *
 * Runs a Solr query and transforms the response. If a full-text search returns
 * zero results in the requested language — typically because that language's
 * `_text_{lang}` fields are not populated for the tenant's catalog — it retries
 * matching against the tenant's default language fields, while keeping the
 * requested language for filters, sorting and display.
 *
 * This is the single source of truth for "search with fallback" used by both
 * the /api/search/search routes and the searchProducts service.
 */

import { SolrClient, getSolrClient } from './solr-client';
import { buildSearchQuery } from './query-builder';
import { transformSearchResponse } from './response-transformer';
import { getSolrConfig } from '@/config/project.config';
import { getTenantDefaultLanguageCode } from '@/lib/services/tenant-languages';
import { SearchRequest, SearchResponse } from '@/lib/types/search';

export interface ExecuteSearchResult {
  response: SearchResponse;
  /** Language whose text fields actually matched (original lang, or the default after fallback). */
  matchedLang: string;
}

/**
 * Execute a search, transparently falling back to the tenant's default
 * language for full-text matching when the requested language yields nothing.
 *
 * @param searchRequest - The (display-language) search request.
 * @param tenantDb - Tenant database (e.g. "vinc-acme-it"). Required for the
 *   default-language fallback; when omitted the shared singleton client is used
 *   and no fallback is attempted.
 */
export async function executeSearchWithFallback(
  searchRequest: SearchRequest,
  tenantDb?: string,
): Promise<ExecuteSearchResult> {
  const config = getSolrConfig();
  const solrClient = tenantDb
    ? new SolrClient(config.url, tenantDb)
    : getSolrClient();

  // group_variants forces parent_entity_code grouping; otherwise honour group.field.
  const groupField = searchRequest.group_variants
    ? 'parent_entity_code'
    : searchRequest.group?.field;

  const run = async (req: SearchRequest): Promise<SearchResponse> => {
    const solrResponse = await solrClient.search(buildSearchQuery(req));
    // Transform with req.lang (display language) regardless of match_lang.
    return transformSearchResponse(
      solrResponse,
      req.lang,
      groupField,
      req.group_variants,
    );
  };

  let response = await run(searchRequest);
  let matchedLang = searchRequest.lang;

  const hasText = !!searchRequest.text && searchRequest.text.trim() !== '';
  const isEmpty = response.results.length === 0;

  if (hasText && isEmpty && tenantDb) {
    const defaultLang = await getTenantDefaultLanguageCode(tenantDb);
    if (defaultLang && defaultLang !== searchRequest.lang) {
      response = await run({ ...searchRequest, match_lang: defaultLang });
      matchedLang = defaultLang;
    }
  }

  return { response, matchedLang };
}
