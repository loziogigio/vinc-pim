/**
 * Solr 9 Search Adapter - Multilingual Support
 * Indexes PIM products into Solr with language-specific fields
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { IPIMProduct as PIMProduct } from '../db/models/pim-product';
import { SynonymDictionaryModel } from '../db/models/synonym-dictionary';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  TransformOptions,
} from './types';

/**
 * Solr multilingual document structure
 * Fields are created dynamically based on enabled languages
 * Pattern: {field}_text_{lang} (e.g., name_text_it, description_text_de)
 */
interface SolrMultilingualDocument {
  // Core identifiers
  id: string;
  sku: string;
  entity_code: string;
  ean?: string[];

  // Versioning & status
  version?: number;
  is_current?: boolean;
  is_current_published?: boolean;
  status: string;
  product_status?: string;

  // Dates
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  item_creation_date?: string;  // ERP insertion date

  // Inventory & pricing
  quantity?: number;
  sold?: number;
  unit?: string;
  price?: number;
  stock_status?: string;

  // Physical Attributes
  weight?: number;
  weight_uom?: string;
  volume?: number;
  volume_uom?: string;
  dimension_height?: number;
  dimension_width?: number;
  dimension_length?: number;
  dimension_uom?: string;

  // Quality
  completeness_score?: number;

  // Analytics
  views_30d?: number;
  clicks_30d?: number;
  add_to_cart_30d?: number;
  conversions_30d?: number;
  priority_score?: number;

  // Relationships (language-independent IDs)
  category_id?: string;
  brand_id?: string;
  product_type_id?: string;
  collection_ids?: string[];
  collection_slugs?: string[];

  // Category hierarchy for faceting (self-contained, no lookups needed)
  category_path?: string[];          // Hierarchical ID path: ["1245", "1245/1244", "1245/1244/644"]
  category_ancestors?: string[];     // All ancestor IDs: ["1245", "1244", "644"]
  category_level?: number;           // Category depth level (0 = root)

  // Brand hierarchy for faceting (brand families)
  brand_path?: string[];             // Hierarchical ID path: ["bosch", "bosch/bosch-professional"]
  brand_ancestors?: string[];        // All ancestor brand IDs
  brand_family?: string;             // Brand family name
  brand_label?: string;              // Brand label for faceting/display

  // Product Type hierarchy for faceting
  product_type_path?: string[];      // Hierarchical ID path: ["tools", "tools/power-tools"]
  product_type_ancestors?: string[]; // All ancestor type IDs
  product_type_level?: number;       // Type hierarchy level

  // Collection hierarchy for faceting
  collection_paths?: string[][];     // Multiple collection paths (product can be in multiple collections)
  collection_ancestors?: string[];   // All collection IDs (flat array)

  // Tag groups for grouped faceting
  tag_groups?: string[];             // Tag group IDs: ["promotions", "features"]
  tag_categories?: string[];         // Tag categories: ["promotion", "seo"]

  // Synonym dictionaries for search enhancement
  synonym_keys?: string[];           // Dictionary keys: ["climatizzatore", "inverter"]
  // synonym_terms_text_{lang} added dynamically per language

  // Promotions
  promo_code?: string[];
  promo_type?: string[];
  has_active_promo?: boolean;

  // Media
  has_video?: boolean;
  image_count?: number;
  cover_image_url?: string;

  // Variations & Faceting
  is_parent?: boolean;
  parent_sku?: string;
  parent_entity_code?: string;
  include_faceting?: boolean; // Controls if product is included in faceting

  // Variants
  variants_sku?: string[];
  variants_entity_code?: string[];

  // Product model
  product_model?: string;

  // Complex objects stored as JSON (for frontend display)
  specifications_json?: string;
  attributes_json?: string;
  promotions_json?: string;
  product_type_features_json?: string;

  // Relationship objects with multilingual content (stored as JSON)
  category_json?: string;
  brand_json?: string;
  collections_json?: string;
  product_type_json?: string;
  tags_json?: string;

  // Language-specific fields (added dynamically)
  [key: string]: any;
}

export class SolrAdapter extends MarketplaceAdapter {
  readonly name = 'Solr 9';
  readonly id = 'solr';
  readonly requiresAuth = false;

  private solrUrl: string;
  private solrCore: string;

  constructor(config: any) {
    super(config);
    // Config comes from loadAdapterConfigs() - single source of truth
    this.solrUrl = config.custom_config?.solr_url;
    this.solrCore = config.custom_config?.solr_core;
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initialized');
  }

  async authenticate(): Promise<void> {
    // Solr doesn't require authentication in basic setup
    this.log('No authentication required');
  }

  async validateProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Basic validations
    if (!product.entity_code) {
      errors.push({
        field: 'entity_code',
        message: 'Entity code is required',
        code: 'MISSING_ENTITY_CODE',
      });
    }

    if (!product.name || Object.keys(product.name).length === 0) {
      errors.push({
        field: 'name',
        message: 'Name is required for search indexing',
        code: 'MISSING_NAME',
      });
    }

    // Warnings
    if (!product.description || Object.keys(product.description).length === 0) {
      warnings.push({
        field: 'description',
        message: 'Description improves search relevance',
        code: 'MISSING_DESCRIPTION',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate include_faceting based on product variant structure
   * Logic:
   * - Single products (no variants): true
   * - Parent products with variants: false (exclude from facets, group only)
   * - Variant products (children): true (include in facets)
   */
  private calculateIncludeFaceting(product: PIMProduct): boolean {
    const hasVariants = (product.variants_sku && product.variants_sku.length > 0) ||
                       (product.variants_entity_code && product.variants_entity_code.length > 0);
    const isChild = !!product.parent_sku || !!product.parent_entity_code;

    // If has variants (is parent with children) → exclude from faceting
    if (hasVariants) {
      return false;
    }

    // If is child or single product → include in faceting
    return true;
  }

  /**
   * Determine Solr field suffix and typed value based on attribute value type
   * Uses Solr's built-in dynamic field patterns:
   * - Strings → _s suffix (single value)
   * - Numbers → _f suffix (float, single value)
   * - Booleans → _b suffix (single value)
   * - String arrays → _ss suffix (multiValued strings)
   * - Number arrays → _fs suffix (multiValued floats)
   *
   * IMPORTANT: Only actual numbers (typeof === 'number') are treated as numeric.
   * Numeric strings like "30" stay as strings to preserve data integrity.
   */
  private getAttributeTypeSuffix(value: any): { suffix: string; value: any } {
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { suffix: 'ss', value: [] };
      }
      // Check if ALL elements are actual numbers (not just numeric strings)
      const allNumbers = value.every(v => typeof v === 'number' && !isNaN(v));
      if (allNumbers) {
        // Number array - use _fs (multiValued floats)
        return { suffix: 'fs', value: value };
      }
      // String array (default for arrays) - use _ss (multiValued strings)
      // Preserve string values as-is, don't auto-convert numeric strings
      return { suffix: 'ss', value: value.map(v => String(v)) };
    }

    if (typeof value === 'boolean') {
      return { suffix: 'b', value };
    }
    // Only actual numbers get _f suffix, not numeric strings
    if (typeof value === 'number' && !isNaN(value)) {
      return { suffix: 'f', value };
    }
    // Default to string - preserve all string values as strings
    return { suffix: 's', value: String(value) };
  }

  /**
   * Build self-contained category hierarchy paths for faceting
   * Creates breadcrumb-style paths that work without database lookups
   *
   * @param category - Category with optional hierarchy field
   * @returns Object with paths for ID-based and named faceting
   */
  private buildCategoryPaths(category: any): {
    category_path: string[];        // ID-based hierarchical paths
    category_ancestors: string[];   // All ancestor IDs for filtering
    category_level: number;         // Category depth
  } {
    if (!category) {
      return {
        category_path: [],
        category_ancestors: [],
        category_level: 0
      };
    }

    const categoryId = category.category_id;
    const level = category.level ?? 0;

    // Use hierarchy field if available (self-contained mode)
    if (category.hierarchy && Array.isArray(category.hierarchy)) {
      const ancestors: string[] = [];
      const paths: string[] = [];
      let currentPath = '';

      // Build paths from hierarchy
      for (const ancestor of category.hierarchy) {
        ancestors.push(ancestor.category_id);
        currentPath = currentPath ? `${currentPath}/${ancestor.category_id}` : ancestor.category_id;
        paths.push(currentPath);
      }

      // Add current category
      ancestors.push(categoryId);
      currentPath = currentPath ? `${currentPath}/${categoryId}` : categoryId;
      paths.push(currentPath);

      return {
        category_path: paths,
        category_ancestors: ancestors,
        category_level: level
      };
    }

    // Fallback: Use path array if available (minimal mode)
    if (category.path && Array.isArray(category.path)) {
      const ancestors = category.path;
      const paths: string[] = [];
      let currentPath = '';

      for (const ancestorId of ancestors) {
        currentPath = currentPath ? `${currentPath}/${ancestorId}` : ancestorId;
        paths.push(currentPath);
      }

      // Add current category
      currentPath = currentPath ? `${currentPath}/${categoryId}` : categoryId;
      paths.push(currentPath);

      return {
        category_path: paths,
        category_ancestors: [...ancestors, categoryId],
        category_level: level
      };
    }

    // Single category (no ancestors)
    return {
      category_path: [categoryId],
      category_ancestors: [categoryId],
      category_level: level
    };
  }

  /**
   * Build language-specific named category paths for breadcrumb display
   * Uses hierarchy field for self-contained data
   *
   * @param category - Category with hierarchy field
   * @param lang - Language code (e.g., 'it', 'en')
   * @returns Named path array for breadcrumb display
   */
  private buildNamedCategoryPath(category: any, lang: string): string[] {
    if (!category || !category.hierarchy || !Array.isArray(category.hierarchy)) {
      // Fallback: Just return current category name
      const categoryName = category?.name?.[lang] || category?.category_id || '';
      return categoryName ? [categoryName] : [];
    }

    const namedPath: string[] = [];

    // Build breadcrumb from hierarchy
    for (const ancestor of category.hierarchy) {
      const ancestorName = ancestor.name?.[lang] || ancestor.category_id;
      namedPath.push(ancestorName);
    }

    // Add current category
    const categoryName = category.name?.[lang] || category.category_id;
    namedPath.push(categoryName);

    return namedPath;
  }

  /**
   * Build brand hierarchy paths for faceting (brand families)
   */
  private buildBrandPaths(brand: any): {
    brand_path: string[];
    brand_ancestors: string[];
    brand_family?: string;
  } {
    if (!brand) {
      return { brand_path: [], brand_ancestors: [] };
    }

    const brandId = brand.brand_id;

    // Use hierarchy field if available (self-contained mode)
    if (brand.hierarchy && Array.isArray(brand.hierarchy)) {
      const ancestors: string[] = [];
      const paths: string[] = [];
      let currentPath = '';

      for (const ancestor of brand.hierarchy) {
        ancestors.push(ancestor.brand_id);
        currentPath = currentPath ? `${currentPath}/${ancestor.brand_id}` : ancestor.brand_id;
        paths.push(currentPath);
      }

      ancestors.push(brandId);
      currentPath = currentPath ? `${currentPath}/${brandId}` : brandId;
      paths.push(currentPath);

      return {
        brand_path: paths,
        brand_ancestors: ancestors,
        brand_family: brand.brand_family || (brand.hierarchy[0]?.label)
      };
    }

    // Single brand (no hierarchy)
    return {
      brand_path: [brandId],
      brand_ancestors: [brandId],
      brand_family: brand.brand_family
    };
  }

  /**
   * Build product type hierarchy paths for faceting
   */
  private buildProductTypePaths(productType: any): {
    product_type_path: string[];
    product_type_ancestors: string[];
    product_type_level: number;
  } {
    if (!productType) {
      return { product_type_path: [], product_type_ancestors: [], product_type_level: 0 };
    }

    const typeId = productType.product_type_id;
    const level = productType.level ?? 0;

    // Use hierarchy field if available (self-contained mode)
    if (productType.hierarchy && Array.isArray(productType.hierarchy)) {
      const ancestors: string[] = [];
      const paths: string[] = [];
      let currentPath = '';

      for (const ancestor of productType.hierarchy) {
        ancestors.push(ancestor.product_type_id);
        currentPath = currentPath ? `${currentPath}/${ancestor.product_type_id}` : ancestor.product_type_id;
        paths.push(currentPath);
      }

      ancestors.push(typeId);
      currentPath = currentPath ? `${currentPath}/${typeId}` : typeId;
      paths.push(currentPath);

      return {
        product_type_path: paths,
        product_type_ancestors: ancestors,
        product_type_level: level
      };
    }

    // Single type (no hierarchy)
    return {
      product_type_path: [typeId],
      product_type_ancestors: [typeId],
      product_type_level: level
    };
  }

  /**
   * Build collection hierarchy paths for faceting
   * Products can be in multiple collections
   */
  private buildCollectionPaths(collections: any[]): {
    collection_paths: string[][];
    collection_ancestors: string[];
  } {
    if (!collections || collections.length === 0) {
      return { collection_paths: [], collection_ancestors: [] };
    }

    const allPaths: string[][] = [];
    const allAncestors = new Set<string>();

    for (const collection of collections) {
      const collectionId = collection.collection_id;

      if (collection.hierarchy && Array.isArray(collection.hierarchy)) {
        const paths: string[] = [];
        let currentPath = '';

        for (const ancestor of collection.hierarchy) {
          allAncestors.add(ancestor.collection_id);
          currentPath = currentPath ? `${currentPath}/${ancestor.collection_id}` : ancestor.collection_id;
          paths.push(currentPath);
        }

        allAncestors.add(collectionId);
        currentPath = currentPath ? `${currentPath}/${collectionId}` : collectionId;
        paths.push(currentPath);

        allPaths.push(paths);
      } else {
        // Single collection (no hierarchy)
        allAncestors.add(collectionId);
        allPaths.push([collectionId]);
      }
    }

    return {
      collection_paths: allPaths,
      collection_ancestors: Array.from(allAncestors)
    };
  }

  /**
   * Extract tag groups and categories for faceting
   */
  private buildTagFacetData(tags: any[]): {
    tag_groups: string[];
    tag_categories: string[];
  } {
    if (!tags || tags.length === 0) {
      return { tag_groups: [], tag_categories: [] };
    }

    const groups = new Set<string>();
    const categories = new Set<string>();

    for (const tag of tags) {
      if (tag.tag_group) {
        groups.add(tag.tag_group);
      }
      if (tag.tag_category) {
        categories.add(tag.tag_category);
      }
      // Also extract from tag_group_data if available
      if (tag.tag_group_data?.group_id) {
        groups.add(tag.tag_group_data.group_id);
      }
    }

    return {
      tag_groups: Array.from(groups),
      tag_categories: Array.from(categories)
    };
  }

  /**
   * Transform PIM product to Solr multilingual document
   * Converts MongoDB multilingual structure to Solr language-specific fields
   */
  async transformProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SolrMultilingualDocument> {
    const lang = options?.language; // Optional: index only specific language

    // Build all entity hierarchy paths (self-contained, no DB lookups)
    const categoryPaths = this.buildCategoryPaths(product.category);
    const brandPaths = this.buildBrandPaths(product.brand);
    const productTypePaths = this.buildProductTypePaths(product.product_type);
    const collectionPaths = this.buildCollectionPaths(product.collections || []);
    const tagFacetData = this.buildTagFacetData(product.tags || []);

    // Base document with language-independent fields
    const doc: SolrMultilingualDocument = {
      id: product.entity_code,
      sku: product.sku || product.entity_code,
      entity_code: product.entity_code,
      ean: product.ean,

      // Versioning
      version: product.version,
      is_current: product.isCurrent,
      is_current_published: product.isCurrentPublished,
      status: product.status,
      product_status: product.product_status,

      // Dates
      created_at: product.created_at?.toISOString(),
      updated_at: product.updated_at?.toISOString(),
      published_at: product.published_at?.toISOString(),
      item_creation_date: product.item_creation_date?.toISOString(),  // ERP insertion date

      // Inventory
      quantity: product.quantity,
      sold: product.sold,
      unit: product.unit,
      stock_status: product.stock_status,

      // Physical Attributes
      weight: product.weight,
      weight_uom: product.weight_uom,
      volume: product.volume,
      volume_uom: product.volume_uom,
      dimension_height: product.dimension_height,
      dimension_width: product.dimension_width,
      dimension_length: product.dimension_length,
      dimension_uom: product.dimension_uom,

      // Quality
      completeness_score: product.completeness_score,

      // Analytics
      views_30d: product.analytics?.views_30d,
      clicks_30d: product.analytics?.clicks_30d,
      add_to_cart_30d: product.analytics?.add_to_cart_30d,
      conversions_30d: product.analytics?.conversions_30d,
      priority_score: product.analytics?.priority_score,

      // Relationships (IDs)
      category_id: product.category?.category_id,
      brand_id: product.brand?.brand_id,
      product_type_id: product.product_type?.product_type_id,
      collection_ids: product.collections?.length ? [...new Set(product.collections.map(c => c.collection_id).filter(Boolean))] : [],
      // Extract slugs from multilingual objects (e.g., { it: "test-nuovo" } -> ["test-nuovo"])
      collection_slugs: product.collections?.length
        ? [...new Set(product.collections.flatMap(c => {
            if (!c.slug) return [];
            if (typeof c.slug === 'string') return [c.slug];
            return Object.values(c.slug).filter(Boolean);
          }))]
        : [],

      // Category hierarchy for faceting (self-contained)
      category_path: categoryPaths.category_path,
      category_ancestors: categoryPaths.category_ancestors,
      category_level: categoryPaths.category_level,

      // Brand hierarchy for faceting (brand families)
      brand_path: brandPaths.brand_path,
      brand_ancestors: brandPaths.brand_ancestors,
      brand_family: brandPaths.brand_family,
      brand_label: product.brand?.label,

      // Product Type hierarchy for faceting
      product_type_path: productTypePaths.product_type_path,
      product_type_ancestors: productTypePaths.product_type_ancestors,
      product_type_level: productTypePaths.product_type_level,

      // Collection hierarchy for faceting
      collection_paths: collectionPaths.collection_paths,
      collection_ancestors: collectionPaths.collection_ancestors,

      // Tag groups for grouped faceting
      tag_groups: tagFacetData.tag_groups,
      tag_categories: tagFacetData.tag_categories,

      // Synonym dictionaries for search enhancement
      synonym_keys: product.synonym_keys || [],
      // synonym_terms are added per-language in the loop below as synonym_terms_text_{lang}

      // Promotions
      promo_code: product.promo_code || product.promotions?.filter(p => p.is_active).map(p => p.promo_code).filter(Boolean) as string[],
      promo_type: product.promo_type || [...new Set(product.promotions?.filter(p => p.is_active).map(p => p.promo_type).filter(Boolean))] as string[],
      has_active_promo: product.has_active_promo || product.promotions?.some(p => p.is_active) || false,

      // Media
      has_video: product.media?.some(m => m.type === 'video'),
      image_count: product.images?.length || 0,
      cover_image_url: product.images?.[0]?.url,

      // Variations & Faceting
      // Use product's explicit values, or calculate based on variant structure
      is_parent: product.is_parent ?? (!product.parent_sku && !product.parent_entity_code),
      parent_sku: product.parent_sku,
      parent_entity_code: product.parent_entity_code,
      include_faceting: product.include_faceting ?? this.calculateIncludeFaceting(product),

      // Variants
      variants_sku: product.variants_sku,
      variants_entity_code: product.variants_entity_code,

      // Product model
      product_model: product.product_model,

      // Complex objects stored as JSON (for frontend display, not faceting)
      specifications_json: product.specifications ? JSON.stringify(product.specifications) : undefined,
      attributes_json: product.attributes ? JSON.stringify(product.attributes) : undefined,
      promotions_json: product.promotions ? JSON.stringify(product.promotions) : undefined,
      product_type_features_json: product.product_type?.features ? JSON.stringify(product.product_type.features) : undefined,

      // Relationship objects with multilingual content (stored as JSON)
      category_json: product.category ? JSON.stringify(product.category) : undefined,
      brand_json: product.brand ? JSON.stringify(product.brand) : undefined,
      collections_json: product.collections ? JSON.stringify(product.collections) : undefined,
      product_type_json: product.product_type ? JSON.stringify(product.product_type) : undefined,
      tags_json: product.tags ? JSON.stringify(product.tags) : undefined,
    };

    // Add multilingual fields for each language
    const languages = lang ? [lang] : this.detectLanguages(product);

    for (const l of languages) {
      // Core product fields - text fields for full-text search
      if (product.name?.[l]) {
        doc[`name_text_${l}`] = product.name[l];
        // Lowercase string field for "starts with" prefix matching
        doc[`name_sort_${l}`] = product.name[l].toLowerCase();
      }
      if (product.slug?.[l]) {
        doc[`slug_text_${l}`] = product.slug[l];
      }
      if (product.description?.[l]) {
        doc[`description_text_${l}`] = product.description[l];
        // Lowercase string field for "starts with" prefix matching
        doc[`description_sort_${l}`] = product.description[l].toLowerCase();
      }
      if (product.short_description?.[l]) {
        doc[`short_description_text_${l}`] = product.short_description[l];
        // Lowercase string field for "starts with" prefix matching
        doc[`short_description_sort_${l}`] = product.short_description[l].toLowerCase();
      }

      // Features (array of strings)
      if (product.features?.[l]) {
        doc[`features_text_${l}`] = product.features[l];
      }

      // SEO fields
      if (product.meta_title?.[l]) {
        doc[`meta_title_text_${l}`] = product.meta_title[l];
      }
      if (product.meta_description?.[l]) {
        doc[`meta_description_text_${l}`] = product.meta_description[l];
      }

      // Specification labels (extract from nested array)
      if (product.specifications?.[l]) {
        // Handle both array format and JSON string format
        let specs: any = product.specifications[l];
        if (typeof specs === 'string') {
          try {
            specs = JSON.parse(specs);
          } catch (e) {
            // If parsing fails, skip this field
            specs = null;
          }
        }

        if (Array.isArray(specs)) {
          const specLabels = specs.map((spec: any) => spec.label).filter(Boolean);
          if (specLabels.length > 0) {
            doc[`spec_labels_text_${l}`] = specLabels;
          }
        }
      }

      // Attribute labels AND values for text search
      // Attributes are multilingual: { it: { "colore": { label: "Colore", value: "ROSSO", order: 0 }, ... } }
      const langAttrs = product.attributes?.[l];
      if (langAttrs && typeof langAttrs === 'object' && !Array.isArray(langAttrs)) {
        const attrLabels: string[] = [];
        const attrValues: string[] = [];

        for (const [attrKey, attrData] of Object.entries(langAttrs)) {
          if (attrData && typeof attrData === 'object') {
            // Collect labels for text search
            if ((attrData as any).label) {
              attrLabels.push((attrData as any).label);
            }
            // Collect string values for text search (e.g., "CROMATO", "PEGASO", "NT300")
            const value = (attrData as any).value;
            if (value !== undefined && value !== null && value !== '') {
              if (typeof value === 'string') {
                attrValues.push(value);
              } else if (Array.isArray(value)) {
                attrValues.push(...value.filter((v: any) => typeof v === 'string'));
              }
            }
          }
        }

        if (attrLabels.length > 0) {
          doc[`attr_labels_text_${l}`] = attrLabels;
        }
        if (attrValues.length > 0) {
          doc[`attr_values_text_${l}`] = attrValues;
        }

        // Dynamic attribute fields for faceting/filtering
        // Creates: attribute_{slug}_s, attribute_{slug}_f, attribute_{slug}_ss, etc.
        for (const [attrKey, attrData] of Object.entries(langAttrs)) {
          if (attrData && typeof attrData === 'object') {
            const value = (attrData as any).value;
            if (value !== undefined && value !== null && value !== '') {
              const { suffix, value: typedValue } = this.getAttributeTypeSuffix(value);
              // Use attribute slug as field name: attribute_colore_s = "ROSSO"
              doc[`attribute_${attrKey}_${suffix}`] = typedValue;
            }
          }
        }
      }

      // Media labels (extract from media array)
      if (product.media) {
        const mediaLabels = product.media
          .map(m => m.label?.[l])
          .filter(Boolean) as string[];
        if (mediaLabels.length > 0) {
          doc[`media_labels_text_${l}`] = mediaLabels;
        }
      }

      // Category name and slug
      if (product.category?.name?.[l]) {
        doc[`category_name_text_${l}`] = product.category.name[l];
      }
      if (product.category?.slug?.[l]) {
        doc[`category_slug_text_${l}`] = product.category.slug[l];
      }

      // Category breadcrumb path (self-contained, for faceting display)
      // Example: ["Utensili", "Elettroutensili", "Ferramenta"]
      const namedPath = this.buildNamedCategoryPath(product.category, l);
      if (namedPath.length > 0) {
        doc[`category_breadcrumb_${l}`] = namedPath;
      }

      // Collection names and slugs (always set to ensure removal works)
      const collectionNames = product.collections
        ?.map(c => c.name?.[l])
        .filter(Boolean) as string[] || [];
      doc[`collection_names_text_${l}`] = collectionNames;

      const collectionSlugs = product.collections
        ?.map(c => c.slug?.[l])
        .filter(Boolean) as string[] || [];
      doc[`collection_slugs_text_${l}`] = collectionSlugs;

      // Tag names
      if (product.tags) {
        const tagNames = product.tags
          .map(t => t.name?.[l])
          .filter(Boolean) as string[];
        if (tagNames.length > 0) {
          doc[`tag_names_text_${l}`] = tagNames;
        }
      }

      // Packaging labels
      if (product.packaging_options) {
        const packagingLabels = product.packaging_options
          .map(p => p.label?.[l])
          .filter(Boolean) as string[];
        if (packagingLabels.length > 0) {
          doc[`packaging_labels_text_${l}`] = packagingLabels;
        }
      }

      // Promotion labels
      if (product.promotions) {
        const promoLabels = product.promotions
          .filter(p => p.is_active)
          .map(p => p.label?.[l])
          .filter(Boolean) as string[];
        if (promoLabels.length > 0) {
          doc[`promo_labels_text_${l}`] = promoLabels;
        }
      }

      // Product type name and slug
      if (product.product_type?.name?.[l]) {
        doc[`product_type_name_text_${l}`] = product.product_type.name[l];
      }
      if (product.product_type?.slug?.[l]) {
        doc[`product_type_slug_text_${l}`] = product.product_type.slug[l];
      }

      // Product type features (labels)
      if (product.product_type?.features) {
        const featureLabels = product.product_type.features
          .map(f => f.label?.[l])
          .filter(Boolean) as string[];
        if (featureLabels.length > 0) {
          doc[`product_type_feature_labels_text_${l}`] = featureLabels;
        }
      }

      // Synonym terms for search enhancement (per language)
      if (product.synonym_keys && product.synonym_keys.length > 0) {
        try {
          const dictionaries = await SynonymDictionaryModel.find({
            key: { $in: product.synonym_keys },
            locale: l,
            is_active: true,
          }).select('terms').lean();

          const allTerms = dictionaries.flatMap((d: any) => d.terms || []);
          if (allTerms.length > 0) {
            doc[`synonym_terms_text_${l}`] = [...new Set(allTerms)]; // Deduplicate
          }
        } catch (error) {
          // Log but don't fail the indexing if synonym lookup fails
          console.warn(`Failed to fetch synonym terms for locale ${l}:`, error);
        }
      }
    }

    return doc;
  }

  /**
   * Detect which languages are present in the product
   */
  private detectLanguages(product: PIMProduct): string[] {
    const languageSet = new Set<string>();

    // Check all multilingual fields
    const multilingualFields = [
      product.name,
      product.slug,
      product.description,
      product.short_description,
      product.meta_title,
      product.meta_description,
    ];

    for (const field of multilingualFields) {
      if (field && typeof field === 'object') {
        Object.keys(field).forEach(lang => languageSet.add(lang));
      }
    }

    // Check features
    if (product.features && typeof product.features === 'object') {
      Object.keys(product.features).forEach(lang => languageSet.add(lang));
    }

    // Check specifications
    if (product.specifications && typeof product.specifications === 'object') {
      Object.keys(product.specifications).forEach(lang => languageSet.add(lang));
    }

    // Note: Attributes ARE language-keyed: { it: { slug: { label, value, uom } }, en: {...} }
    // But we don't need to check them here since name/description already provide languages
    if (product.attributes && typeof product.attributes === 'object') {
      Object.keys(product.attributes).forEach(lang => languageSet.add(lang));
    }

    return Array.from(languageSet);
  }

  async syncProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SyncResult> {
    try {
      const langInfo = options?.language ? ` (language: ${options.language})` : '';
      this.log(`Indexing product: ${product.entity_code}${langInfo}`);

      // Validate first
      const validation = await this.validateProduct(product, options);
      if (!validation.isValid) {
        return {
          success: false,
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Transform to Solr document
      const doc = await this.transformProduct(product, options);

      // Send to Solr (use array format for Solr 9)
      const updateUrl = `${this.solrUrl}/${this.solrCore}/update?commit=true`;
      const response = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([doc]), // Wrap in array for Solr 9
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Solr indexing failed: ${response.status} - ${error}`);
      }

      this.log(`✓ Indexed product: ${product.entity_code}${langInfo}`);

      return {
        success: true,
        marketplace_id: product.entity_code,
        status: 'active',
        message: 'Product indexed successfully',
      };
    } catch (error: any) {
      this.logError('Failed to index product', error);
      return {
        success: false,
        status: 'error',
        message: error.message,
        errors: [error.message],
      };
    }
  }

  async deleteProduct(productId: string): Promise<SyncResult> {
    try {
      this.log(`Deleting product from index: ${productId}`);

      const deleteUrl = `${this.solrUrl}/${this.solrCore}/update?commit=true`;
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delete: { id: productId },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Solr delete failed: ${response.status} - ${error}`);
      }

      return {
        success: true,
        status: 'active',
        message: 'Product deleted from index',
      };
    } catch (error: any) {
      this.logError('Failed to delete product', error);
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  async syncInventory(
    sku: string,
    quantity: number
  ): Promise<InventorySyncResult> {
    try {
      // Atomic update of stock_quantity field
      const updateUrl = `${this.solrUrl}/${this.solrCore}/update/json/docs?commit=true`;
      const response = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: sku,
          quantity: { set: quantity },
        }),
      });

      if (!response.ok) {
        throw new Error(`Solr inventory update failed: ${response.status}`);
      }

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory updated in search index',
      };
    } catch (error: any) {
      return {
        success: false,
        sku,
        quantity,
        message: error.message,
      };
    }
  }

  async syncPrice(sku: string, price: number): Promise<SyncResult> {
    try {
      // Atomic update of price field
      const updateUrl = `${this.solrUrl}/${this.solrCore}/update/json/docs?commit=true`;
      const response = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: sku,
          price: { set: price },
        }),
      });

      if (!response.ok) {
        throw new Error(`Solr price update failed: ${response.status}`);
      }

      return {
        success: true,
        status: 'active',
        message: 'Price updated in search index',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const pingUrl = `${this.solrUrl}/${this.solrCore}/admin/ping`;
      const response = await fetch(pingUrl);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure Solr collection exists (SolrCloud mode), create if needed
   */
  async ensureCollection(): Promise<{ exists: boolean; created: boolean }> {
    try {
      // Check if collection exists via Collections API (SolrCloud)
      const listUrl = `${this.solrUrl}/admin/collections?action=LIST&wt=json`;
      const listResponse = await fetch(listUrl);

      if (!listResponse.ok) {
        // Fallback: try pinging the core directly (standalone mode)
        const pingOk = await this.testConnection();
        return { exists: pingOk, created: false };
      }

      const data = await listResponse.json();

      if (data.collections?.includes(this.solrCore)) {
        this.log(`Collection '${this.solrCore}' exists`);
        return { exists: true, created: false };
      }

      // Collection doesn't exist, create it
      this.log(`Creating collection '${this.solrCore}'...`);
      const createUrl = `${this.solrUrl}/admin/collections?action=CREATE&name=${this.solrCore}&numShards=1&replicationFactor=1&collection.configName=_default&wt=json`;
      const createResponse = await fetch(createUrl);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create collection: ${createResponse.status} - ${errorText}`);
      }

      const createData = await createResponse.json();
      if (createData.error) {
        throw new Error(createData.error.msg || JSON.stringify(createData.error));
      }

      this.log(`Collection '${this.solrCore}' created successfully`);
      return { exists: true, created: true };
    } catch (error: any) {
      this.log(`Warning: Could not verify/create collection: ${error.message}`, 'warn');
      throw error;
    }
  }

  /**
   * Bulk index multiple products
   */
  async bulkIndexProducts(
    products: PIMProduct[],
    options?: TransformOptions
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Transform all products
      const docs = await Promise.all(
        products.map((p) => this.transformProduct(p, options))
      );

      // Send bulk update (docs is already an array)
      const updateUrl = `${this.solrUrl}/${this.solrCore}/update?commit=true`;
      const response = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(docs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Bulk index failed: ${response.status} - ${errorBody}`);
      }

      results.success = products.length;
      const langInfo = options?.language ? ` for language ${options.language}` : '';
      this.log(`✓ Bulk indexed ${products.length} products${langInfo}`);
    } catch (error: any) {
      results.failed = products.length;
      results.errors.push(error.message);
      this.logError('Bulk index failed', error);
    }

    return results;
  }

  /**
   * Clear entire index (use with caution!)
   */
  async clearIndex(): Promise<void> {
    const deleteUrl = `${this.solrUrl}/${this.solrCore}/update?commit=true`;
    await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        delete: { query: '*:*' },
      }),
    });
    this.log('⚠️  Index cleared');
  }
}
