/**
 * ELIA AI Search Types
 * Type definitions for intent extraction and product analysis
 */

// ============================================
// CONFIGURATION
// ============================================

export interface EliaConfig {
  anthropicApiKey: string;
  intentModel: string;
  analysisModel: string;
  minResults: number;
  maxQueryLength: number;
  minQueryLength: number;
}

export function getEliaConfig(): EliaConfig {
  return {
    anthropicApiKey: process.env.VINC_ANTHROPIC_API_KEY || '',
    intentModel: process.env.ELIA_INTENT_MODEL || 'claude-3-haiku-20240307',
    analysisModel: process.env.ELIA_ANALYSIS_MODEL || 'claude-sonnet-4-20250514',
    minResults: parseInt(process.env.ELIA_MIN_RESULTS || '10', 10),
    maxQueryLength: parseInt(process.env.ELIA_MAX_QUERY_LENGTH || '300', 10),
    minQueryLength: parseInt(process.env.ELIA_MIN_QUERY_LENGTH || '3', 10),
  };
}

// ============================================
// INTENT EXTRACTION
// ============================================

/**
 * Type of search intent detected from user query
 */
export type SearchIntentType = 'ricerca' | 'confronto' | 'consiglio' | 'specifico';

/**
 * Sort preference extracted from user intent
 */
export type SortPreference = 'relevance' | 'price_asc' | 'price_desc' | 'quality' | 'newest' | 'popularity';

/**
 * Stock filter preference
 */
export type StockFilter = 'any' | 'in_stock' | 'available_soon';

/**
 * Synonym term with precision score
 */
export interface SynonymTerm {
  /** The synonym term */
  term: string;
  /** Precision score 0-1 (1 = exact match, 0 = loosely related) */
  precision: number;
}

/**
 * Complete intent extraction result from Claude
 * Separates product and attribute synonyms for flexible cascade search
 */
export interface EliaIntentExtraction {
  /** Type of search intent */
  intent_type: SearchIntentType;

  // ============================================
  // PRODUCT SYNONYMS (2 levels)
  // ============================================
  /** Exact product terms from user query (precision: 1.0) */
  product_exact: SynonymTerm[];
  /** Product synonyms - similar terms (precision: 0.9-0.7, min 2) */
  product_synonyms: SynonymTerm[];

  // ============================================
  // ATTRIBUTE SYNONYMS (3 levels, min 3 terms each)
  // ============================================
  /** Exact attribute terms from user query (precision: 1.0) */
  attribute_exact: SynonymTerm[];
  /** Attribute synonyms - similar features (precision: 0.9-0.7, min 3) */
  attribute_synonyms: SynonymTerm[];
  /** Attribute related - related concepts (precision: 0.6-0.4, min 3) */
  attribute_related: SynonymTerm[];

  // ============================================
  // SPEC SYNONYMS (3 levels, technical specifications)
  // ============================================
  /** Exact spec terms from user query (precision: 1.0) - e.g., "5kg", "100cm" */
  spec_exact: SynonymTerm[];
  /** Spec synonyms - similar measurements (precision: 0.9-0.7, min 3) */
  spec_synonyms: SynonymTerm[];
  /** Spec related - related specifications (precision: 0.6-0.4, min 3) */
  spec_related: SynonymTerm[];

  // ============================================
  // FILTERS & MODIFIERS
  // ============================================
  /** Sort preference based on user intent */
  sort_by: SortPreference;
  /** Stock availability filter */
  stock_filter: StockFilter;
  /** Minimum price filter */
  price_min?: number;
  /** Maximum price filter */
  price_max?: number;
  /** Numeric constraints (e.g., area in m², capacity in liters) */
  constraints?: {
    min?: number;
    max?: number;
    unit?: string;
  };

  // ============================================
  // RESPONSE
  // ============================================
  /** Friendly response intro in target language */
  user_message: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * JSON Schema for EliaIntentExtraction (for Claude structured outputs)
 * Separates product and attribute synonyms for flexible cascade search
 */
export const EliaIntentExtractionSchema = {
  type: 'object' as const,
  description: 'Intent extraction with separated product/attribute synonyms for cascade search',
  properties: {
    intent_type: {
      type: 'string' as const,
      enum: ['ricerca', 'confronto', 'consiglio', 'specifico'],
      description: 'Type of search intent',
    },
    // ============================================
    // PRODUCT SYNONYMS (2 levels)
    // ============================================
    product_exact: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The product term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (1.0 for exact)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 1,
      description: 'Exact product terms from user query (precision: 1.0)',
    },
    product_synonyms: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The synonym term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (0.9-0.7)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 2,
      description: 'Product synonyms - similar terms (precision: 0.9-0.7, min 2)',
    },
    // ============================================
    // ATTRIBUTE SYNONYMS (3 levels)
    // ============================================
    attribute_exact: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The attribute term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (1.0 for exact)' },
        },
        required: ['term', 'precision'],
      },
      description: 'Exact attribute terms from user query (precision: 1.0)',
    },
    attribute_synonyms: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The synonym term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (0.9-0.7)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 3,
      description: 'Attribute synonyms - similar features (precision: 0.9-0.7, min 3)',
    },
    attribute_related: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The related term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (0.6-0.4)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 3,
      description: 'Attribute related - related concepts (precision: 0.6-0.4, min 3)',
    },
    // ============================================
    // SPEC SYNONYMS (3 levels)
    // ============================================
    spec_exact: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The spec term (e.g., "5kg", "100cm")' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (1.0 for exact)' },
        },
        required: ['term', 'precision'],
      },
      description: 'Exact spec terms from user query (precision: 1.0)',
    },
    spec_synonyms: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The spec synonym term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (0.9-0.7)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 3,
      description: 'Spec synonyms - similar measurements (precision: 0.9-0.7, min 3)',
    },
    spec_related: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          term: { type: 'string' as const, description: 'The related spec term' },
          precision: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Precision score (0.6-0.4)' },
        },
        required: ['term', 'precision'],
      },
      minItems: 3,
      description: 'Spec related - related specifications (precision: 0.6-0.4, min 3)',
    },
    // ============================================
    // FILTERS & MODIFIERS
    // ============================================
    sort_by: {
      type: 'string' as const,
      enum: ['relevance', 'price_asc', 'price_desc', 'quality', 'newest', 'popularity'],
      description: 'Sort preference based on user intent modifiers',
    },
    stock_filter: {
      type: 'string' as const,
      enum: ['any', 'in_stock', 'available_soon'],
      description: 'Stock filter: any (default), in_stock (available now), available_soon (pre-order)',
    },
    price_min: {
      type: 'number' as const,
      description: 'Minimum price filter',
    },
    price_max: {
      type: 'number' as const,
      description: 'Maximum price filter',
    },
    constraints: {
      type: 'object' as const,
      properties: {
        min: { type: 'number' as const, description: 'Minimum constraint value' },
        max: { type: 'number' as const, description: 'Maximum constraint value' },
        unit: { type: 'string' as const, description: 'Unit of measure (m², liters, etc.)' },
      },
      description: 'Numeric constraints (e.g., area in m², capacity in liters)',
    },
    // ============================================
    // RESPONSE
    // ============================================
    user_message: {
      type: 'string' as const,
      description: 'Friendly response intro in target language',
    },
    confidence: {
      type: 'number' as const,
      minimum: 0,
      maximum: 1,
      description: 'Confidence score 0-1',
    },
  },
  required: [
    'intent_type',
    'product_exact',
    'product_synonyms',
    'attribute_exact',
    'attribute_synonyms',
    'attribute_related',
    'spec_exact',
    'spec_synonyms',
    'spec_related',
    'sort_by',
    'stock_filter',
    'user_message',
    'confidence',
  ],
};

// ============================================
// PRODUCT ANALYSIS
// ============================================

/**
 * Analyzed product returned by Claude
 */
export interface AnalyzedProductResult {
  /** Product entity code */
  entity_code: string;
  /** Attribute match score 0-1 */
  attribute_match_score: number;
  /** Reasons for the match score */
  match_reasons: string[];
  /** Why this product was ranked at this position */
  ranking_reason?: string;
}

/**
 * Complete analysis result from Claude
 */
export interface EliaProductAnalysisResult {
  /** Reordered products with scores */
  products: AnalyzedProductResult[];
  /** Total count after filtering */
  total_count: number;
  /** Applied filters summary */
  applied_filters: {
    sort_by: string;
    stock_filter: string;
    attribute_filters: string[];
  };
  /** User-friendly summary in target language */
  summary: string;
}

/**
 * JSON Schema for EliaProductAnalysisResult (for Claude structured outputs)
 */
export const EliaProductAnalysisSchema = {
  type: 'object' as const,
  description: 'Product analysis result with reordered products and scores',
  properties: {
    products: {
      type: 'array' as const,
      description: 'Reordered products with match scores',
      items: {
        type: 'object' as const,
        properties: {
          entity_code: {
            type: 'string' as const,
            description: 'Product entity code',
          },
          attribute_match_score: {
            type: 'number' as const,
            minimum: 0,
            maximum: 1,
            description: 'Attribute match score 0-1',
          },
          match_reasons: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Reasons for the match score (in user language)',
          },
          ranking_reason: {
            type: 'string' as const,
            description: 'Why this product was ranked at this position',
          },
        },
        required: ['entity_code', 'attribute_match_score', 'match_reasons'],
      },
    },
    total_count: {
      type: 'number' as const,
      description: 'Total count after filtering',
    },
    applied_filters: {
      type: 'object' as const,
      properties: {
        sort_by: { type: 'string' as const },
        stock_filter: { type: 'string' as const },
        attribute_filters: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
      },
      required: ['sort_by', 'stock_filter', 'attribute_filters'],
    },
    summary: {
      type: 'string' as const,
      description: 'User-friendly summary in target language',
    },
  },
  required: ['products', 'total_count', 'applied_filters', 'summary'],
};

/**
 * Analysis of a single product by Claude
 */
export interface ProductMatch {
  /** Product entity code */
  entity_code: string;
  /** Relevance score 0-1 */
  relevance_score: number;
  /** Why this product matches the query */
  match_reasons: string[];
  /** Key selling point highlight */
  highlight?: string;
}

/**
 * Complete product analysis result from Claude
 */
export interface EliaProductAnalysis {
  /** Personalized intro message for user */
  intro_message: string;
  /** Analyzed products with relevance */
  products: ProductMatch[];
  /** Best choice recommendation */
  recommendation?: string;
  /** Suggested follow-up questions */
  follow_up_questions: string[];
}

// ============================================
// API REQUEST/RESPONSE
// ============================================

/**
 * Search request to ELIA API
 */
export interface EliaSearchRequest {
  /** User natural language query (3-300 chars) */
  query: string;
  /** Tenant identifier */
  tenant_id: string;
  /** Response language (default: "it") */
  language?: string;
  /** Number of results (default: 10, max: 20) */
  limit?: number;
}

/**
 * Search response from ELIA API
 */
export interface EliaSearchResponse {
  /** Unique search identifier */
  search_id: string;
  /** Original user query */
  query: string;
  /** Detected intent info */
  intent: {
    type: SearchIntentType;
    /** Which synonym level matched (0=exact, 1-3=synonyms) */
    matched_level: number;
    confidence: number;
  };
  /** AI intro message */
  intro_message: string;
  /** Total products found */
  total_found: number;
  /** Products with AI analysis */
  products: ProductMatch[];
  /** AI recommendation */
  recommendation?: string;
  /** Suggested follow-up questions */
  follow_up_questions: string[];
  /** Response timestamp */
  timestamp: string;
}

/**
 * Error response from ELIA API
 */
export interface EliaErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'INTENT_EXTRACTION_FAILED' | 'SEARCH_FAILED' | 'ANALYSIS_FAILED' | 'INTERNAL_ERROR';
  details?: string;
}

// ============================================
// INTERNAL TYPES
// ============================================

/**
 * Product data sent to Claude for analysis
 * Excludes full description to save tokens
 */
export interface ProductForAnalysis {
  entity_code: string;
  name: string;
  short_description?: string;
  features: string[];
  price: number;
  brand_name?: string;
  category_path?: string[];
  attributes: Record<string, unknown>;
  images: string[];
  rating?: number;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

/**
 * Result of cascade search
 */
export interface CascadeSearchResult {
  /** Products found */
  products: ProductForAnalysis[];
  /** Total count from Solr */
  total_count: number;
  /** Which cascade level matched */
  matched_level: number;
  /** Search text used at matched level */
  matched_search_text: string;
  /** Product keywords used at this level */
  matched_products: string[];
  /** Attribute keywords used at this level */
  matched_attributes: string[];
  /** Spec keywords used at this level */
  matched_specs: string[];
}