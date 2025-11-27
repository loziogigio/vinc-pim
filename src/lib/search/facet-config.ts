/**
 * Facet Field Configuration
 * Defines available facets and their behavior
 *
 * IMPORTANT: Solr configuration is sourced from the adapters module
 * to maintain a single source of truth with sync operations.
 */

import { FacetFieldConfig, SolrConfig } from '@/lib/types/search';
import { loadAdapterConfigs } from '@/lib/adapters';

// ============================================
// SOLR CONFIGURATION (Single Source of Truth)
// ============================================

/**
 * Get Solr configuration from the adapters module
 * This ensures search uses the same Solr instance as sync operations
 */
export function getSolrConfig(): SolrConfig {
  const adapterConfigs = loadAdapterConfigs();
  const solrConfig = adapterConfigs.solr?.custom_config || {};

  // All Solr config comes from adapter config (single source of truth)
  return {
    url: solrConfig.solr_url,
    core: solrConfig.solr_core,
    defaultRows: parseInt(process.env.SEARCH_DEFAULT_ROWS || '20', 10),
    maxRows: parseInt(process.env.SEARCH_MAX_ROWS || '100', 10),
    facetLimit: parseInt(process.env.FACET_DEFAULT_LIMIT || '100', 10),
    facetMinCount: parseInt(process.env.FACET_MIN_COUNT || '1', 10),
  };
}

/**
 * Check if Solr is enabled
 */
export function isSolrEnabled(): boolean {
  return process.env.SOLR_ENABLED === 'true';
}

// ============================================
// FACET FIELD CONFIGURATION
// ============================================

export const FACET_FIELDS_CONFIG: Record<string, FacetFieldConfig> = {
  // Hierarchical facets (support drill-down navigation)
  category_ancestors: {
    type: 'hierarchical',
    label: 'Categoria',
    label_field: 'category_json',
  },
  brand_ancestors: {
    type: 'hierarchical',
    label: 'Marca',
    label_field: 'brand_json',
  },
  product_type_ancestors: {
    type: 'hierarchical',
    label: 'Tipo Prodotto',
    label_field: 'product_type_json',
  },
  collection_ancestors: {
    type: 'hierarchical',
    label: 'Collezione',
    label_field: 'collections_json',
  },

  // Flat selection facets
  brand_id: {
    type: 'flat',
    label: 'Marca',
    label_field: 'brand_json',
  },
  category_id: {
    type: 'flat',
    label: 'Categoria',
    label_field: 'category_json',
  },
  product_type_id: {
    type: 'flat',
    label: 'Tipo Prodotto',
    label_field: 'product_type_json',
  },
  stock_status: {
    type: 'flat',
    label: 'Disponibilità',
    labels: {
      in_stock: 'Disponibile',
      out_of_stock: 'Non disponibile',
      pre_order: 'Preordine',
    },
  },
  status: {
    type: 'flat',
    label: 'Stato',
    labels: {
      draft: 'Bozza',
      published: 'Pubblicato',
      archived: 'Archiviato',
    },
  },
  tag_groups: {
    type: 'flat',
    label: 'Caratteristiche',
  },
  tag_categories: {
    type: 'flat',
    label: 'Tag',
  },

  // Boolean facets
  has_active_promo: {
    type: 'boolean',
    label: 'In Promozione',
    labels: {
      true: 'Sì',
      false: 'No',
    },
  },
  has_video: {
    type: 'boolean',
    label: 'Con Video',
    labels: {
      true: 'Sì',
      false: 'No',
    },
  },
  is_parent: {
    type: 'boolean',
    label: 'Prodotto Principale',
    labels: {
      true: 'Sì',
      false: 'No',
    },
  },

  // Dynamic attribute facets (from product attributes)
  attribute_is_new_b: {
    type: 'boolean',
    label: 'Nuovo Arrivo',
    labels: {
      true: 'Sì',
      false: 'No',
    },
  },

  // Range facets
  price: {
    type: 'range',
    label: 'Prezzo',
    ranges: [
      { from: 0, to: 50, label: '€0 - €50' },
      { from: 50, to: 100, label: '€50 - €100' },
      { from: 100, to: 500, label: '€100 - €500' },
      { from: 500, to: 1000, label: '€500 - €1000' },
      { from: 1000, label: 'Oltre €1000' },
    ],
  },
  completeness_score: {
    type: 'range',
    label: 'Completezza',
    ranges: [
      { from: 0, to: 25, label: '0-25%' },
      { from: 25, to: 50, label: '25-50%' },
      { from: 50, to: 75, label: '50-75%' },
      { from: 75, to: 100, label: '75-100%' },
    ],
  },
};

// ============================================
// DEFAULT FACETS
// ============================================

/**
 * Default facet fields for B2B search
 */
export const DEFAULT_FACET_FIELDS = [
  'category_ancestors',
  'brand_id',
  'stock_status',
  'has_active_promo',
  'price',
];

/**
 * Default facet fields for PIM admin
 */
export const PIM_FACET_FIELDS = [
  'status',
  'category_ancestors',
  'brand_id',
  'completeness_score',
  'has_active_promo',
];

// ============================================
// MULTILINGUAL FIELD MAPPING
// ============================================

/**
 * Fields that have multilingual versions in Solr
 * Pattern: {field}_text_{lang}
 */
export const MULTILINGUAL_TEXT_FIELDS = [
  'name',
  'slug',
  'description',
  'short_description',
  'features',
  'meta_title',
  'meta_description',
  'category_name',
  'category_slug',
  'category_breadcrumb',
  'collection_names',
  'collection_slugs',
  'tag_names',
  'promo_labels',
  'product_type_name',
  'product_type_slug',
];

/**
 * Get multilingual field name for Solr
 */
export function getMultilingualField(field: string, lang: string): string {
  if (MULTILINGUAL_TEXT_FIELDS.includes(field)) {
    return `${field}_text_${lang}`;
  }
  return field;
}

// ============================================
// SORT FIELD MAPPING
// ============================================

/**
 * Map sort field names to Solr field names
 */
export function getSortField(field: string, lang: string): string {
  const sortFieldMap: Record<string, string> = {
    price: 'price',
    relevance: 'score',
    newest: 'created_at',
    popularity: 'priority_score',
    completeness: 'completeness_score',
    name: `name_text_${lang}`,
    priority: 'priority_score',
  };

  return sortFieldMap[field] || field;
}

// ============================================
// FILTER FIELD MAPPING
// ============================================

/**
 * Map filter field names to Solr field names
 */
export const FILTER_FIELD_MAP: Record<string, string> = {
  // Direct mappings (no change needed)
  category_id: 'category_id',
  category_ancestors: 'category_ancestors',
  brand_id: 'brand_id',
  brand_ancestors: 'brand_ancestors',
  product_type_id: 'product_type_id',
  product_type_ancestors: 'product_type_ancestors',
  collection_ids: 'collection_ids',
  collection_ancestors: 'collection_ancestors',
  tag_groups: 'tag_groups',
  tag_categories: 'tag_categories',
  promo_codes: 'promo_codes',
  stock_status: 'stock_status',
  status: 'status',
  has_active_promo: 'has_active_promo',
  sku: 'sku',
  ean: 'ean',
  entity_code: 'entity_code',
  is_parent: 'is_parent',
  include_faceting: 'include_faceting',
  // Attribute filters (map friendly names to Solr dynamic fields)
  is_new: 'attribute_is_new_b',
  attribute_is_new_b: 'attribute_is_new_b',
};

/**
 * Get Solr filter field name
 */
export function getFilterField(field: string): string {
  return FILTER_FIELD_MAP[field] || field;
}
