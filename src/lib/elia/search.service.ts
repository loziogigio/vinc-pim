/**
 * ELIA Search Service
 * 12-level cascade search using searchProducts directly
 *
 * Cascade order:
 * - Phase 1 (0-3):  product_exact + attrs → fallback
 * - Phase 2 (4-7):  syn[0] + attrs → fallback
 * - Phase 3 (8-11): syn[1] + attrs → fallback
 */

import { SolrProduct } from '@/lib/types/search';
import { EliaIntentExtraction, getEliaConfig } from '@/lib/types/elia';
import {
  getCascadeLevels,
  getCascadeLevelName,
  buildCascadeSearchText,
  extractTermStrings,
  getProductTerms,
  getAttributeTerms,
  getSpecTerms,
} from './intent.service';
import { searchProducts } from '@/lib/search';

// ============================================
// DIRECT SEARCH (no HTTP overhead)
// ============================================

/**
 * Execute search directly via searchProducts service
 */
async function executeSearch(params: {
  text?: string;
  lang: string;
  rows: number;
  tenantDb?: string;
}): Promise<{ results: SolrProduct[]; numFound: number }> {
  console.log('[ELIA Search] Solr request:', JSON.stringify(params, null, 2));

  const result = await searchProducts({
    text: params.text,
    lang: params.lang,
    rows: params.rows,
    include_faceting: true, // ELIA needs facets for filtering
    group_variants: false, // No variant grouping for ELIA
    tenantDb: params.tenantDb, // Pass tenant database
  });

  return {
    results: result.data.results,
    numFound: result.data.numFound,
  };
}

// ============================================
// CASCADE SEARCH
// ============================================

export interface CascadeSearchOptions {
  /** Language for search (default: 'it') */
  language?: string;
  /** Minimum results threshold (default: 10) */
  minResults?: number;
  /** Maximum results to return (default: 20) */
  maxResults?: number;
  /** Tenant database (e.g., vinc-hidros-it) */
  tenantDb?: string;
}

/**
 * Result of cascade search
 */
export interface CascadeSearchResult {
  /** Products found */
  products: SolrProduct[];
  /** Total count from Solr */
  total_count: number;
  /** Which cascade level matched */
  matched_level: number;
  /** Search text used at matched level */
  matched_search_text: string;
  /** Product terms used */
  matched_products: string[];
  /** Attribute terms used */
  matched_attributes: string[];
  /** Spec terms used */
  matched_specs: string[];
}

/**
 * Execute 24-level cascade search through Solr
 *
 * Levels 0-17: All product × attribute combinations
 * Levels 18-23: Product-only fallbacks (LAST RESORT)
 *
 * Stops when >= minResults found
 */
export async function cascadeSearch(
  intent: EliaIntentExtraction,
  options: CascadeSearchOptions = {}
): Promise<CascadeSearchResult> {
  const config = getEliaConfig();
  const {
    language = 'it',
    minResults = config.minResults,
    maxResults = 20,
    tenantDb,
  } = options;

  const cascadeLevels = getCascadeLevels();

  // Note: We only use text search in cascade - no filters
  // Filters (stock, price) are applied later by Claude in analyze step

  let bestResult: CascadeSearchResult | null = null;

  console.log(`[ELIA Search] Starting 24-level cascade (minResults: ${minResults})`);

  for (const cascadeLevel of cascadeLevels) {
    const levelName = getCascadeLevelName(cascadeLevel.level);
    const searchText = buildCascadeSearchText(intent, cascadeLevel);

    // Get terms for logging
    const productTerms = getProductTerms(intent, cascadeLevel.productLevel);
    const attributeTerms = getAttributeTerms(intent, cascadeLevel.attributeLevel);
    const specTerms = getSpecTerms(intent, cascadeLevel.specLevel);

    console.log(`[ELIA Search] Level ${cascadeLevel.level}: "${searchText}" (${levelName})`);

    try {
      // Cascade uses text-only search - no filters applied here
      const result = await searchWithText(searchText, {
        language,
        maxResults,
        tenantDb, // Pass tenant database
      });

      console.log(`[ELIA Search] Level ${cascadeLevel.level} found ${result.total_count} products`);

      // Update best result if this has more results
      if (!bestResult || result.total_count > bestResult.total_count) {
        bestResult = {
          products: result.products,
          total_count: result.total_count,
          matched_level: cascadeLevel.level,
          matched_search_text: searchText,
          matched_products: extractTermStrings(productTerms),
          matched_attributes: extractTermStrings(attributeTerms),
          matched_specs: extractTermStrings(specTerms),
        };
      }

      // Stop if we have enough results
      if (result.total_count >= minResults) {
        console.log(`[ELIA Search] Found ${result.total_count} >= ${minResults} at level ${cascadeLevel.level}, stopping cascade`);
        return bestResult;
      }
    } catch (error) {
      console.error(`[ELIA Search] Error at level ${cascadeLevel.level}:`, error);
      // Continue to next level on error
    }
  }

  // Return best result we found, or empty result
  if (bestResult) {
    console.log(`[ELIA Search] Using best result from level ${bestResult.matched_level} with ${bestResult.total_count} products`);
    return bestResult;
  }

  // No results found at any level
  console.log('[ELIA Search] No results found at any cascade level');
  return {
    products: [],
    total_count: 0,
    matched_level: -1,
    matched_search_text: '',
    matched_products: [],
    matched_attributes: [],
    matched_specs: [],
  };
}

// ============================================
// SEARCH EXECUTION
// ============================================

interface SearchOptions {
  language: string;
  maxResults: number;
  tenantDb?: string;
}

interface SearchResult {
  products: SolrProduct[];
  total_count: number;
}

/**
 * Execute search with text query only
 * Uses searchProducts directly (no HTTP overhead)
 * No filters applied - cascade is text-only search
 */
async function searchWithText(
  searchText: string,
  options: SearchOptions
): Promise<SearchResult> {
  const { language, maxResults, tenantDb } = options;

  // Call searchProducts directly - text only, no filters
  // Filters (stock, price, sort) are applied later by Claude in analyze step
  const response = await executeSearch({
    text: searchText,
    lang: language,
    rows: maxResults,
    tenantDb, // Pass tenant database
  });

  return {
    products: response.results,
    total_count: response.numFound,
  };
}

// ============================================
// FULL SEARCH (Intent + Cascade)
// ============================================

import { extractSearchIntent } from './intent.service';

export interface EliaSearchOptions {
  /** Language for search (default: 'it') */
  language?: string;
  /** Minimum results threshold (default: 10) */
  minResults?: number;
  /** Maximum results to return (default: 20) */
  maxResults?: number;
}

export interface EliaSearchResult {
  /** Search ID for tracking */
  search_id: string;
  /** Original query */
  query: string;
  /** Full intent from Claude (pass this to Step 3 analyze) */
  intent: EliaIntentExtraction;
  /** Search metadata */
  search_info: {
    /** Which cascade level matched */
    matched_level: number;
    /** Human-readable level name */
    matched_level_name: string;
    /** Search text used at matched level */
    matched_search_text: string;
  };
  /** Products found */
  products: SolrProduct[];
  /** Total count */
  total_found: number;
  /** Product terms used in matched search */
  matched_products: string[];
  /** Attribute terms used in matched search */
  matched_attributes: string[];
  /** Spec terms used in matched search */
  matched_specs: string[];
}

/**
 * Full ELIA search: extract intent + cascade search
 */
export async function eliaSearch(
  query: string,
  options: EliaSearchOptions = {}
): Promise<EliaSearchResult> {
  const { language = 'it', minResults, maxResults } = options;

  // Step 1: Extract intent
  const intentResult = await extractSearchIntent(query, language);

  if (!intentResult.success || !intentResult.intent) {
    throw new Error(intentResult.error || 'Intent extraction failed');
  }

  const intent = intentResult.intent;

  // Step 2: Cascade search
  const searchResult = await cascadeSearch(intent, {
    language,
    minResults,
    maxResults,
  });

  // Generate search ID
  const searchId = `elia_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    search_id: searchId,
    query,
    // Full intent - B2B passes this to Step 3 analyze
    intent,
    // Search metadata
    search_info: {
      matched_level: searchResult.matched_level,
      matched_level_name: getCascadeLevelName(searchResult.matched_level),
      matched_search_text: searchResult.matched_search_text,
    },
    products: searchResult.products,
    total_found: searchResult.total_count,
    matched_products: searchResult.matched_products,
    matched_attributes: searchResult.matched_attributes,
    matched_specs: searchResult.matched_specs,
  };
}
