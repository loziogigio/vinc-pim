/**
 * Intent Service
 * Handles intent extraction and validation
 */

import { extractIntent } from './claude.service';
import {
  getEliaConfig,
  EliaIntentExtraction,
  SynonymTerm,
} from '@/lib/types/elia';

// ============================================
// VALIDATION
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate user search query
 */
export function validateQuery(query: string): ValidationResult {
  const config = getEliaConfig();

  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query is required' };
  }

  const trimmed = query.trim();

  if (trimmed.length < config.minQueryLength) {
    return {
      valid: false,
      error: `Query must be at least ${config.minQueryLength} characters`,
    };
  }

  if (trimmed.length > config.maxQueryLength) {
    return {
      valid: false,
      error: `Query must not exceed ${config.maxQueryLength} characters`,
    };
  }

  return { valid: true };
}

// ============================================
// INTENT EXTRACTION
// ============================================

export interface IntentExtractionResult {
  success: boolean;
  intent?: EliaIntentExtraction;
  error?: string;
}

/**
 * Check if an object is a valid SynonymTerm
 */
function isValidSynonymTerm(obj: unknown): obj is SynonymTerm {
  if (!obj || typeof obj !== 'object') return false;
  const term = obj as Record<string, unknown>;
  return (
    typeof term.term === 'string' &&
    term.term.length > 0 &&
    typeof term.precision === 'number' &&
    term.precision >= 0 &&
    term.precision <= 1
  );
}

/**
 * Check if a field is a valid SynonymTerm array with minimum items
 */
function isValidSynonymArray(arr: unknown, minItems: number = 0): arr is SynonymTerm[] {
  return Array.isArray(arr) && arr.length >= minItems && arr.every(isValidSynonymTerm);
}

/**
 * Extract intent from user query with validation
 */
export async function extractSearchIntent(
  query: string,
  language: string = 'it'
): Promise<IntentExtractionResult> {
  // Validate query
  const validation = validateQuery(query);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const intent = await extractIntent(query.trim(), language);

    // Log raw intent for debugging
    console.log('Raw intent received:', typeof intent, intent);

    // Validate product synonym arrays (SynonymTerm objects) - 2 levels
    if (!isValidSynonymArray(intent.product_exact, 1)) {
      return { success: false, error: 'Invalid intent: product_exact must have at least 1 SynonymTerm' };
    }
    if (!isValidSynonymArray(intent.product_synonyms, 2)) {
      return { success: false, error: 'Invalid intent: product_synonyms must have at least 2 SynonymTerms' };
    }

    // Validate attribute synonym arrays - 3 levels
    if (!isValidSynonymArray(intent.attribute_exact, 0)) {
      return { success: false, error: 'Invalid intent: attribute_exact must be an array of SynonymTerms' };
    }
    if (!isValidSynonymArray(intent.attribute_synonyms, 3)) {
      return { success: false, error: 'Invalid intent: attribute_synonyms must have at least 3 SynonymTerms' };
    }
    if (!isValidSynonymArray(intent.attribute_related, 3)) {
      return { success: false, error: 'Invalid intent: attribute_related must have at least 3 SynonymTerms' };
    }

    // Validate spec synonym arrays - 3 levels
    if (!isValidSynonymArray(intent.spec_exact, 0)) {
      return { success: false, error: 'Invalid intent: spec_exact must be an array of SynonymTerms' };
    }
    if (!isValidSynonymArray(intent.spec_synonyms, 3)) {
      return { success: false, error: 'Invalid intent: spec_synonyms must have at least 3 SynonymTerms' };
    }
    if (!isValidSynonymArray(intent.spec_related, 3)) {
      return { success: false, error: 'Invalid intent: spec_related must have at least 3 SynonymTerms' };
    }

    return { success: true, intent };
  } catch (error) {
    return {
      success: false,
      error: `Intent extraction failed: ${(error as Error).message}`,
    };
  }
}

// ============================================
// INTENT HELPERS
// ============================================

/**
 * Cascade search level configuration
 * 3 product levels × 4 attribute levels × 4 spec levels
 * But simplified to: product × (combined attribute+spec) levels
 */
export interface CascadeLevel {
  level: number;
  name: string;
  productLevel: 0 | 1 | 2;  // 0=exact, 1=syn[0], 2=syn[1]
  attributeLevel: 0 | 1 | 2 | 3;  // 0=exact, 1=synonyms, 2=related, 3=none
  specLevel: 0 | 1 | 2 | 3;  // 0=exact, 1=synonyms, 2=related, 3=none
}

/**
 * Get all cascade levels in priority order (12 levels)
 *
 * Order: Each product level exhausts all attribute+spec options (including fallback)
 * before moving to the next synonym level.
 * Specs are kept in sync with attributes (same level) to avoid explosion of combinations.
 *
 * Phase 1 (0-3):  product_exact + all attrs/specs → product_exact fallback
 * Phase 2 (4-7):  syn[0] + all attrs/specs → syn[0] fallback
 * Phase 3 (8-11): syn[1] + all attrs/specs → syn[1] fallback
 */
export function getCascadeLevels(): CascadeLevel[] {
  return [
    // ========================================
    // PHASE 1: product_exact (levels 0-3)
    // ========================================
    { level: 0, name: 'exact + attr_exact + spec_exact', productLevel: 0, attributeLevel: 0, specLevel: 0 },
    { level: 1, name: 'exact + attr_syn + spec_syn', productLevel: 0, attributeLevel: 1, specLevel: 1 },
    { level: 2, name: 'exact + attr_related + spec_related', productLevel: 0, attributeLevel: 2, specLevel: 2 },
    { level: 3, name: 'exact only', productLevel: 0, attributeLevel: 3, specLevel: 3 },
    // ========================================
    // PHASE 2: product_synonyms[0] (levels 4-7)
    // ========================================
    { level: 4, name: 'syn[0] + attr_exact + spec_exact', productLevel: 1, attributeLevel: 0, specLevel: 0 },
    { level: 5, name: 'syn[0] + attr_syn + spec_syn', productLevel: 1, attributeLevel: 1, specLevel: 1 },
    { level: 6, name: 'syn[0] + attr_related + spec_related', productLevel: 1, attributeLevel: 2, specLevel: 2 },
    { level: 7, name: 'syn[0] only', productLevel: 1, attributeLevel: 3, specLevel: 3 },
    // ========================================
    // PHASE 3: product_synonyms[1] (levels 8-11)
    // ========================================
    { level: 8, name: 'syn[1] + attr_exact + spec_exact', productLevel: 2, attributeLevel: 0, specLevel: 0 },
    { level: 9, name: 'syn[1] + attr_syn + spec_syn', productLevel: 2, attributeLevel: 1, specLevel: 1 },
    { level: 10, name: 'syn[1] + attr_related + spec_related', productLevel: 2, attributeLevel: 2, specLevel: 2 },
    { level: 11, name: 'syn[1] only', productLevel: 2, attributeLevel: 3, specLevel: 3 },
  ];
}

/**
 * Get product term for a specific cascade level
 * Returns single term (exact returns all, syn returns individual by index)
 */
export function getProductTerms(intent: EliaIntentExtraction, level: 0 | 1 | 2): SynonymTerm[] {
  switch (level) {
    case 0: return intent.product_exact;
    case 1: return intent.product_synonyms[0] ? [intent.product_synonyms[0]] : [];
    case 2: return intent.product_synonyms[1] ? [intent.product_synonyms[1]] : [];
  }
}

/**
 * Get attribute terms for a specific cascade level
 * Level 3 = none (fallback with no attributes)
 */
export function getAttributeTerms(intent: EliaIntentExtraction, level: 0 | 1 | 2 | 3): SynonymTerm[] {
  switch (level) {
    case 0: return intent.attribute_exact;
    case 1: return intent.attribute_synonyms;
    case 2: return intent.attribute_related;
    case 3: return []; // No attributes (fallback)
  }
}

/**
 * Get spec terms for a specific cascade level
 * Level 3 = none (fallback with no specs)
 */
export function getSpecTerms(intent: EliaIntentExtraction, level: 0 | 1 | 2 | 3): SynonymTerm[] {
  switch (level) {
    case 0: return intent.spec_exact;
    case 1: return intent.spec_synonyms;
    case 2: return intent.spec_related;
    case 3: return []; // No specs (fallback)
  }
}

/**
 * Extract just the term strings from SynonymTerm array
 */
export function extractTermStrings(synonymTerms: SynonymTerm[]): string[] {
  return synonymTerms.map(st => st.term);
}

/**
 * Build search text from product and attribute SynonymTerms
 */
export function buildSearchText(productTerms: SynonymTerm[], attributeTerms: SynonymTerm[]): string {
  const allTerms = [...extractTermStrings(productTerms), ...extractTermStrings(attributeTerms)];
  return allTerms.join(' ');
}

/**
 * Build full search text for a cascade level
 */
export function buildCascadeSearchText(
  intent: EliaIntentExtraction,
  cascadeLevel: CascadeLevel
): string {
  const productTerms = getProductTerms(intent, cascadeLevel.productLevel);
  const attributeTerms = getAttributeTerms(intent, cascadeLevel.attributeLevel);
  const specTerms = getSpecTerms(intent, cascadeLevel.specLevel);

  const parts: string[] = [
    ...extractTermStrings(productTerms),
    ...extractTermStrings(attributeTerms),
    ...extractTermStrings(specTerms),
  ];

  return parts.join(' ');
}

/**
 * Build filters object from intent for Solr query
 */
export function buildFiltersFromIntent(
  intent: EliaIntentExtraction
): Record<string, string | string[] | number | boolean> {
  const filters: Record<string, string | string[] | number | boolean> = {};

  // Price filters
  if (intent.price_min !== undefined) {
    filters.price_min = intent.price_min;
  }
  if (intent.price_max !== undefined) {
    filters.price_max = intent.price_max;
  }

  // Stock filter
  if (intent.stock_filter && intent.stock_filter !== 'any') {
    filters.stock_status = intent.stock_filter === 'in_stock' ? 'in_stock' : 'pre_order';
  }

  // Constraints (numeric)
  if (intent.constraints) {
    if (intent.constraints.min !== undefined) {
      filters.constraint_min = intent.constraints.min;
    }
    if (intent.constraints.max !== undefined) {
      filters.constraint_max = intent.constraints.max;
    }
    if (intent.constraints.unit) {
      filters.constraint_unit = intent.constraints.unit;
    }
  }

  return filters;
}

/**
 * Map sort_by to Solr sort field
 */
export function mapSortPreference(sortBy: string): string {
  switch (sortBy) {
    case 'price_asc':
      return 'price asc';
    case 'price_desc':
      return 'price desc';
    case 'quality':
      return 'completeness_score desc';
    case 'newest':
      return 'created_at desc';
    case 'popularity':
      return 'priority_score desc';
    case 'relevance':
    default:
      return 'score desc';
  }
}

/**
 * Get intent level name for logging/debugging
 */
export function getCascadeLevelName(level: number): string {
  const levels = getCascadeLevels();
  return levels[level]?.name || `unknown_${level}`;
}