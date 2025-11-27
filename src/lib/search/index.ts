/**
 * Search Library
 * Solr search integration for PIM
 */

// Types (re-export from centralized location)
export * from '@/lib/types/search';

// Configuration
export {
  getSolrConfig,
  isSolrEnabled,
  FACET_FIELDS_CONFIG,
  DEFAULT_FACET_FIELDS,
  PIM_FACET_FIELDS,
  MULTILINGUAL_TEXT_FIELDS,
  getMultilingualField,
  getSortField,
  getFilterField,
} from './facet-config';

// Solr Client
export {
  SolrClient,
  getSolrClient,
  SolrError,
  type SolrJsonQuery,
  type SolrJsonFacet,
} from './solr-client';

// Query Builder
export {
  buildSearchQuery,
  buildFacetOnlyQuery,
  buildQueryParams,
} from './query-builder';

// Response Transformer
export {
  transformSearchResponse,
  transformFacetResponse,
  transformDocument,
  getMultilingualValue,
} from './response-transformer';
