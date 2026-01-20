/**
 * Search & Faceting Type Definitions
 * Types for Solr search integration
 */

// ============================================
// REQUEST TYPES
// ============================================

export interface SearchRequest {
  // Full-text search
  text?: string;
  lang: string; // Language code (it, de, en...)

  // Pagination
  start?: number; // Offset (default: 0)
  rows?: number; // Limit (default: 20, max: 100)

  // Filters
  filters?: SearchFilters;

  // Sorting
  sort?: {
    field: SortField;
    order: 'asc' | 'desc';
  };

  // Fuzzy search options (like dfl-api)
  fuzzy?: boolean; // Enable fuzzy matching (default: false)
  fuzzy_num?: number; // Fuzzy distance 1-2 (default: 1)

  // Variant control
  include_faceting?: boolean; // Only products meant for faceting (default: true)
  include_variants?: boolean; // Include variant products (default: true)
  group_variants?: boolean; // Group by parent_entity_code (default: false)

  // Grouping options - group results by a specific field
  group?: GroupOptions;

  // Inline facets
  facet_fields?: string[]; // Return facets inline with search results
}

export interface GroupOptions {
  field: string; // Field to group by (e.g., 'brand_id', 'category_id', 'product_model')
  limit?: number; // Max docs per group (default: 3)
  sort?: string; // Sort within group (e.g., 'price asc')
  ngroups?: boolean; // Return total number of groups (default: true)
  main?: boolean; // Use flat document list format (default: false)
  truncate?: boolean; // Truncate facet counts to match groups (default: true)
}

export interface SearchFilters {
  // Hierarchical filters
  category_id?: string | string[];
  category_ancestors?: string | string[];
  brand_id?: string | string[];
  brand_ancestors?: string | string[];
  product_type_id?: string | string[];
  product_type_ancestors?: string | string[];
  collection_ids?: string | string[];

  // Flat filters
  tag_groups?: string | string[];
  tag_categories?: string | string[];
  promo_codes?: string | string[];
  stock_status?: string | string[];
  has_active_promo?: boolean;
  status?: string | string[];

  // Range filters
  price_min?: number;
  price_max?: number;

  // Direct lookups
  sku?: string | string[];
  ean?: string | string[];
  entity_code?: string | string[];

  // Dynamic attribute filters
  [key: string]: string | string[] | number | boolean | undefined;
}

export type SortField =
  | 'price'
  | 'relevance'
  | 'newest'
  | 'popularity'
  | 'completeness'
  | 'name'
  | 'priority';

export interface FacetRequest {
  lang: string;
  filters?: SearchFilters;
  text?: string;
  facet_fields: string[];
  facet_limit?: number; // Max values per facet (default: 100)
  facet_mincount?: number; // Min count to include (default: 1)
  facet_sort?: 'count' | 'index';
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface SearchResponse {
  results: SolrProduct[];
  numFound: number; // Number of groups (unique products) when grouped, or total docs
  matches?: number; // Total matching documents (only present when grouped)
  start: number;
  facet_results?: FacetResults;
  // Grouped response fields (when group option is used)
  grouped?: GroupedResults;
}

export interface GroupedResults {
  field: string; // The field used for grouping
  ngroups: number; // Total number of unique groups
  matches: number; // Total matching documents
  groups: ProductGroup[];
}

export interface ProductGroup {
  groupValue: string; // The value of the grouped field
  numFound: number; // Number of docs in this group
  docs: SolrProduct[]; // Documents in this group (limited by group.limit)
}

export interface SolrProduct {
  id: string;
  sku: string;
  entity_code: string;
  ean?: string[];

  // Resolved for requested language
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  long_description?: string;
  marketing_features?: string[];

  // Pricing & inventory
  price?: number;
  quantity?: number;
  sold?: number;
  unit?: string;
  stock_status?: string;

  // Media - Full gallery and media arrays
  cover_image_url?: string;
  image_count?: number;
  has_video?: boolean;
  image?: ImageData;
  images?: ImageAsset[];
  gallery?: GalleryImage[];
  media?: MediaItem[];

  // Taxonomy (parsed from JSON - full objects)
  brand?: BrandData;
  category?: CategoryData;
  product_type?: ProductTypeData;
  collections?: CollectionData[];
  tags?: TagData[];

  // Attributes & Technical Specifications (for requested language)
  attributes?: AttributeData[];
  technical_specifications?: SpecificationData[];

  // Promotions
  has_active_promo?: boolean;
  promo_codes?: string[];
  promotions?: PromotionData[];

  // Packaging
  packaging_options?: PackagingData[];

  // Variants
  is_parent?: boolean;
  parent_entity_code?: string;
  parent_sku?: string;
  variants_sku?: string[];
  variants_entity_code?: string[];
  parent_product?: ParentProductData;
  sibling_variants?: SiblingVariantData[];
  include_faceting?: boolean;
  variants?: SolrProduct[]; // Enriched variant products (fetched from Solr)

  // Versioning & Status
  version?: number;
  isCurrent?: boolean;
  isCurrentPublished?: boolean;
  status?: string;
  product_status?: string;
  product_status_description?: string;
  product_model?: string;

  // Quality & Analytics
  completeness_score?: number;
  priority_score?: number;
  analytics?: AnalyticsData;

  // SEO
  meta_title?: string;
  meta_description?: string;

  // Source & Import info
  source?: SourceData;

  // Dates
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

// Supporting types for enriched response
export interface ImageData {
  id?: string;
  thumbnail?: string;
  medium?: string;
  large?: string;
  original?: string;
  blur?: string;
}

export interface ImageAsset {
  url: string;
  cdn_key: string;
  position: number;
  file_name?: string;
  file_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  uploaded_by?: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  s3_key?: string;
  label?: string;
  position: number;
  uploaded_at?: string;
  uploaded_by?: string;
}

export interface MediaItem {
  type: 'document' | 'video' | '3d-model';
  url: string;
  s3_key?: string;
  label?: string;
  language?: string;
  file_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  uploaded_by?: string;
  is_external_link?: boolean;
  position: number;
}

export interface TagData {
  tag_id: string;
  name?: string;
  slug: string;
  description?: string;
  color?: string;
  is_active?: boolean;
  tag_category?: string;
  tag_group?: string;
  tag_group_data?: {
    group_id?: string;
    group_name?: string;
    group_slug?: string;
    group_type?: string;
    display_order?: number;
  };
}

export interface AttributeData {
  key: string;
  label: string;
  value: any;
  order?: number;
}

export interface SpecificationData {
  key: string;
  label: string;
  value: string | number;
  uom?: string;
  category?: string;
  order?: number;
}

export interface PromotionData {
  promo_code?: string;
  is_active: boolean;
  promo_type?: string;
  label?: string;
  discount_percentage?: number;
  discount_amount?: number;
  buy_x?: number;
  get_y?: number;
  is_stackable?: boolean;
  priority?: number;
  start_date?: string;
  end_date?: string;
  min_quantity?: number;
  min_order_value?: number;
}

export interface PackagingData {
  id?: string;
  code: string;
  label?: string;
  qty: number;
  uom: string;
  is_default: boolean;
  is_smallest: boolean;
  is_sellable?: boolean;
  ean?: string;
  position?: number;
}

export interface ParentProductData {
  entity_code: string;
  sku: string;
  name?: string;
  slug?: string;
  cover_image_url?: string;
  price?: number;
  brand?: { brand_id?: string; label?: string; slug?: string };
  category?: { category_id?: string; name?: string; slug?: string };
}

export interface SiblingVariantData {
  entity_code: string;
  sku: string;
  name?: string;
  variant_attributes?: Record<string, any>;
  cover_image_url?: string;
  price?: number;
  stock_status?: string;
  is_active?: boolean;
}

export interface AnalyticsData {
  views_30d?: number;
  clicks_30d?: number;
  add_to_cart_30d?: number;
  conversions_30d?: number;
  priority_score?: number;
  last_synced_at?: string;
}

export interface SourceData {
  source_id: string;
  source_name: string;
  batch_id?: string;
  imported_at?: string;
}

export interface BrandData {
  brand_id: string;
  label?: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
  // Hierarchy fields
  parent_brand_id?: string;
  brand_family?: string;
  level?: number;
  path?: string[];
  hierarchy?: BrandHierarchyItem[];
}

export interface BrandHierarchyItem {
  brand_id: string;
  label?: string;
  slug?: string;
  logo_url?: string;
  level?: number;
}

export interface CategoryData {
  category_id: string;
  name?: string;
  slug?: string;
  details?: string;
  image?: ImageData;
  icon?: string;
  breadcrumb?: string[];
  description?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
  // Hierarchy fields
  parent_id?: string;
  level?: number;
  path?: string[];
  hierarchy?: CategoryHierarchyItem[];
}

export interface CategoryHierarchyItem {
  category_id: string;
  name?: string;
  slug?: string;
  level?: number;
  description?: string;
  image?: ImageData;
  icon?: string;
}

export interface ProductTypeData {
  product_type_id: string;
  name?: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
  technical_specifications?: ProductTypeTechnicalSpecification[];
  // Hierarchy fields
  parent_type_id?: string;
  level?: number;
  path?: string[];
  hierarchy?: ProductTypeHierarchyItem[];
  inherited_technical_specifications?: ProductTypeTechnicalSpecification[];
}

export interface ProductTypeTechnicalSpecification {
  key: string;
  label?: string;
  value?: any;
  unit?: string;
}

export interface ProductTypeHierarchyItem {
  product_type_id: string;
  name?: string;
  slug?: string;
  level?: number;
  description?: string;
  technical_specifications?: ProductTypeTechnicalSpecification[];
}

export interface CollectionData {
  collection_id: string;
  name?: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
  // Hierarchy fields
  parent_collection_id?: string;
  level?: number;
  path?: string[];
  hierarchy?: CollectionHierarchyItem[];
}

export interface CollectionHierarchyItem {
  collection_id: string;
  name?: string;
  slug?: string;
  level?: number;
  description?: string;
}

export interface FacetResponse {
  facet_results: FacetResults;
}

export interface FacetResults {
  [field: string]: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  label: string;
  key_label: string;
  // For hierarchical facets
  level?: number;
  parent_id?: string;
  path?: string;
  // Full entity data from MongoDB (brand, category, product_type, collection, tag)
  entity?: Record<string, unknown>;
}

// ============================================
// SOLR RAW TYPES
// ============================================

export interface SolrRawDocument {
  id: string;
  sku: string;
  entity_code: string;
  ean?: string[];

  // Versioning
  version?: number;
  isCurrent?: boolean;
  isCurrentPublished?: boolean;
  status?: string;
  product_status?: string;

  // Dates
  created_at?: string;
  updated_at?: string;
  published_at?: string;

  // Inventory & pricing
  quantity?: number;
  sold?: number;
  unit?: string;
  price?: number;
  stock_status?: string;

  // Quality
  completeness_score?: number;

  // Analytics
  views_30d?: number;
  clicks_30d?: number;
  add_to_cart_30d?: number;
  conversions_30d?: number;
  priority_score?: number;

  // Relationships
  category_id?: string;
  brand_id?: string;
  product_type_id?: string;
  collection_ids?: string[];

  // Hierarchy paths
  category_path?: string[];
  category_ancestors?: string[];
  category_level?: number;
  brand_path?: string[];
  brand_ancestors?: string[];
  brand_family?: string;
  product_type_path?: string[];
  product_type_ancestors?: string[];
  collection_ancestors?: string[];

  // Tags
  tag_groups?: string[];
  tag_categories?: string[];

  // Promotions
  promo_codes?: string[];
  has_active_promo?: boolean;

  // Media
  has_video?: boolean;
  image_count?: number;
  cover_image_url?: string;

  // Variants
  is_parent?: boolean;
  parent_sku?: string;
  parent_entity_code?: string;
  include_faceting?: boolean;
  variants_sku?: string[];
  variants_entity_code?: string[];

  // Product model
  product_model?: string;

  // JSON stored fields (complex objects)
  category_json?: string;
  brand_json?: string;
  collections_json?: string;
  product_type_json?: string;
  technical_specifications_json?: string;
  attributes_json?: string;
  promotions_json?: string;
  media_json?: string;
  packaging_json?: string;
  product_type_technical_specifications_json?: string;
  tags_json?: string;
  image_json?: string;
  images_json?: string;
  gallery_json?: string;
  parent_product_json?: string;
  sibling_variants_json?: string;
  source_json?: string;

  // Dynamic multilingual fields (name_text_it, description_text_de, etc.)
  [key: string]: any;
}

export interface SolrSearchResponse {
  responseHeader: {
    status: number;
    QTime: number;
  };
  response: {
    numFound: number;
    start: number;
    docs: SolrRawDocument[];
  };
  // Grouped response (when group=true)
  grouped?: {
    [field: string]: SolrGroupedField;
  };
  facets?: SolrFacetResponse;
  facet_counts?: {
    facet_fields: {
      [field: string]: (string | number)[];
    };
  };
}

export interface SolrGroupedField {
  matches: number; // Total matching documents
  ngroups?: number; // Number of unique groups (when group.ngroups=true)
  groups: SolrGroupItem[];
}

export interface SolrGroupItem {
  groupValue: string | null; // Value of the grouped field (null for docs without value)
  doclist: {
    numFound: number;
    start: number;
    docs: SolrRawDocument[];
  };
}

export interface SolrFacetResponse {
  count: number;
  [field: string]:
    | number
    | {
        buckets: SolrFacetBucket[];
      };
}

export interface SolrFacetBucket {
  val: string;
  count: number;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface SolrConfig {
  url: string;
  core: string;
  defaultRows: number;
  maxRows: number;
  facetLimit: number;
  facetMinCount: number;
}

export type FacetType = 'hierarchical' | 'flat' | 'boolean' | 'range';

export interface FacetFieldConfig {
  type: FacetType;
  label: string;
  label_field?: string; // JSON field to get labels from
  labels?: Record<string, string>; // Static labels for values
  ranges?: FacetRange[]; // For range facets
}

export interface FacetRange {
  from?: number;
  to?: number;
  label: string;
}
