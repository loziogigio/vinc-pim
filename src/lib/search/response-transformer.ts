/**
 * Solr Response Transformer
 * Transforms Solr responses to API response format
 */

import {
  SearchResponse,
  FacetResponse,
  SolrProduct,
  FacetResults,
  FacetValue,
  SolrRawDocument,
  SolrSearchResponse,
  BrandData,
  CategoryData,
  ProductTypeData,
  CollectionData,
  TagData,
  MediaItem,
  ImageAsset,
  GalleryImage,
  ImageData,
  SpecificationData,
  AttributeData,
  PromotionData,
  PackagingData,
  ParentProductData,
  SiblingVariantData,
  AnalyticsData,
  SourceData,
  GroupedResults,
  ProductGroup,
} from '@/lib/types/search';
import { FACET_FIELDS_CONFIG } from './facet-config';
import {
  loadBrands,
  loadCategories,
  loadCollections,
  loadProductTypes,
  loadProductTypesByCode,
  loadTags,
  mergeMediaFromParent,
} from './response-enricher';
import { getSolrClient, SolrClient } from './solr-client';
import { getSolrConfig } from '@/config/project.config';

// ============================================
// ENTITY CACHES FOR FACET ENRICHMENT
// ============================================

interface EntityCaches {
  brands: Map<string, any>;
  categories: Map<string, any>;
  collections: Map<string, any>;
  productTypes: Map<string, any>;
  productTypesByCode: Map<string, any>;
  tags: Map<string, any>;
}

// Cache for attribute labels (slug → label per language)
interface AttributeLabelsCache {
  data: Record<string, Record<string, string>>; // { slug: { it: "Label IT", en: "Label EN" } }
  timestamp: number;
}

let attributeLabelsCache: AttributeLabelsCache | null = null;
const ATTRIBUTE_CACHE_TTL = 60000; // 1 minute

/**
 * Load attribute labels from Solr by fetching one document's attributes_json
 * Returns a map of attribute slug → multilingual labels
 */
async function loadAttributeLabels(lang: string, tenantDb?: string): Promise<Map<string, string>> {
  const now = Date.now();
  const labelMap = new Map<string, string>();

  // Check cache validity
  if (attributeLabelsCache && now - attributeLabelsCache.timestamp < ATTRIBUTE_CACHE_TTL) {
    // Return cached labels for requested language
    for (const [slug, labels] of Object.entries(attributeLabelsCache.data)) {
      const label = labels[lang] || labels.it || labels.en || Object.values(labels)[0];
      if (label) labelMap.set(slug, label);
    }
    return labelMap;
  }

  try {
    // Query Solr for ONE document that has attributes_json
    // Use tenant-specific collection if provided
    const config = getSolrConfig();
    const solrClient = tenantDb
      ? new SolrClient(config.url, tenantDb)
      : getSolrClient();
    const response = await solrClient.search({
      query: '*:*',
      filter: ['attributes_json:*'], // Only docs with attributes
      limit: 1,
      fields: ['attributes_json'],
    });

    if (response.response?.docs?.[0]?.attributes_json) {
      const attributesJson = response.response.docs[0].attributes_json;
      const parsed = typeof attributesJson === 'string'
        ? JSON.parse(attributesJson)
        : attributesJson;

      // Build cache: { slug: { lang: label } }
      const cacheData: Record<string, Record<string, string>> = {};

      // Detect format by checking first value structure
      const firstValue = Object.values(parsed)[0];
      const isFlatFormat = firstValue && typeof firstValue === 'object' && 'label' in firstValue;

      if (isFlatFormat) {
        // Flat format: { slug: { label, value, order } }
        for (const [slug, attrData] of Object.entries(parsed as Record<string, any>)) {
          if (attrData?.label) {
            cacheData[slug] = { it: attrData.label };
          }
        }
      } else {
        // Language-keyed format: { it: { slug: { key, label, value } }, en: {...} }
        for (const [langKey, langAttrs] of Object.entries(parsed)) {
          if (typeof langAttrs === 'object' && langAttrs !== null) {
            for (const [slug, attrData] of Object.entries(langAttrs as Record<string, any>)) {
              if (!cacheData[slug]) cacheData[slug] = {};
              if (attrData?.label) {
                cacheData[slug][langKey] = attrData.label;
              }
            }
          }
        }
      }

      // Update cache
      attributeLabelsCache = { data: cacheData, timestamp: now };

      // Return labels for requested language
      for (const [slug, labels] of Object.entries(cacheData)) {
        const label = labels[lang] || labels.it || labels.en || Object.values(labels)[0];
        if (label) labelMap.set(slug, label);
      }
    }
  } catch (error) {
    console.error('[AttributeLabels] Failed to load from Solr:', error);
  }

  return labelMap;
}

/**
 * Extract attribute slug from Solr field name
 * attribute_is_new_b → is_new
 * attribute_colore_s → colore
 */
function extractAttributeSlug(fieldName: string): string | null {
  const match = fieldName.match(/^attribute_(.+)_[sbf]$/);
  return match ? match[1] : null;
}

/**
 * Load all entity caches for facet enrichment
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 */
async function loadEntityCaches(tenantDb: string): Promise<EntityCaches> {
  const [brands, categories, collections, productTypes, productTypesByCode, tags] = await Promise.all([
    loadBrands(tenantDb),
    loadCategories(tenantDb),
    loadCollections(tenantDb),
    loadProductTypes(tenantDb),
    loadProductTypesByCode(tenantDb),
    loadTags(tenantDb),
  ]);

  return { brands, categories, collections, productTypes, productTypesByCode, tags };
}

/**
 * Get full entity data from cache based on label_field config
 */
function getEntityData(
  field: string,
  value: string,
  caches: EntityCaches
): any | undefined {
  const config = FACET_FIELDS_CONFIG[field];
  if (!config?.label_field) return undefined;

  const labelField = config.label_field;

  // Map label_field to appropriate cache
  if (labelField === 'brand_json') {
    return caches.brands.get(value);
  } else if (labelField === 'category_json') {
    return caches.categories.get(value);
  } else if (labelField === 'collections_json') {
    return caches.collections.get(value);
  } else if (labelField === 'product_type_json') {
    return caches.productTypes.get(value);
  } else if (labelField === 'product_type_json_by_code') {
    // Code-based lookup for product_type_code facet
    return caches.productTypesByCode.get(value);
  } else if (labelField === 'tags_json') {
    return caches.tags.get(value);
  }

  return undefined;
}

/**
 * Extract display label from entity data
 */
function extractEntityLabel(entity: any, lang?: string): string | undefined {
  if (!entity) return undefined;

  // Try various common label fields
  const label = entity.label || entity.name;

  // Handle multilingual labels
  if (typeof label === 'object' && label !== null) {
    return label[lang || 'it'] || label.it || label.en || Object.values(label)[0];
  }

  return label;
}

// ============================================
// SEARCH RESPONSE TRANSFORMER
// ============================================

/**
 * Transform Solr search response to API response
 * Handles both regular and grouped responses
 *
 * @param groupField - Field used for grouping (e.g., 'parent_entity_code')
 * @param groupVariants - If true, uses variant grouping mode (parent + variants structure)
 */
export function transformSearchResponse(
  solrResponse: SolrSearchResponse,
  lang: string,
  groupField?: string,
  groupVariants?: boolean
): SearchResponse {
  const { response, grouped, facets, facet_counts } = solrResponse;

  // Handle grouped response
  if (grouped && groupField && grouped[groupField]) {
    // Variant grouping mode (like dfl-api): returns parent with variants array
    if (groupVariants && groupField === 'parent_entity_code') {
      return transformVariantGroupedResponse(solrResponse, lang);
    }
    // Generic grouping mode
    return transformGroupedResponse(solrResponse, lang, groupField);
  }

  // Regular response
  return {
    results: response.docs.map((doc) => transformDocument(doc, lang)),
    numFound: response.numFound,
    start: response.start,
    facet_results: transformFacets(facets, facet_counts, lang),
  };
}

/**
 * Transform grouped Solr response to API response
 */
function transformGroupedResponse(
  solrResponse: SolrSearchResponse,
  lang: string,
  groupField: string
): SearchResponse {
  const { grouped, facets, facet_counts, response } = solrResponse;
  const groupData = grouped![groupField];

  // Build grouped results structure
  const groupedResults: GroupedResults = {
    field: groupField,
    ngroups: groupData.ngroups ?? groupData.groups.length,
    matches: groupData.matches,
    groups: groupData.groups.map((group): ProductGroup => ({
      groupValue: group.groupValue ?? 'null',
      numFound: group.doclist.numFound,
      docs: group.doclist.docs.map((doc) => transformDocument(doc, lang)),
    })),
  };

  // Flatten results for convenience (first doc from each group)
  const flatResults = groupData.groups.flatMap((group) =>
    group.doclist.docs.map((doc) => transformDocument(doc, lang))
  );

  return {
    results: flatResults,
    numFound: groupData.ngroups ?? groupData.groups.length,
    matches: groupData.matches, // Total matching documents
    start: response?.start ?? 0,
    facet_results: transformFacets(facets, facet_counts, lang),
    grouped: groupedResults,
  };
}

/**
 * Transform variant grouped response (like dfl-api)
 * Groups by parent_entity_code and returns parent with variants array
 *
 * Logic:
 * - groupValue IS the parent's entity_code
 * - All docs in the group are variants (children)
 * - Parent product is fetched from MongoDB by entity_code in enrichment step
 * - Returns: { entity_code: groupValue, variants: [...all docs...] }
 */
function transformVariantGroupedResponse(
  solrResponse: SolrSearchResponse,
  lang: string
): SearchResponse {
  const { grouped, facets, facet_counts, response } = solrResponse;
  const groupData = grouped!['parent_entity_code'];

  const results: SolrProduct[] = [];

  for (const group of groupData.groups) {
    const docs = group.doclist.docs;
    const parentEntityCode = group.groupValue;

    if (docs.length === 0) continue;

    // Transform all docs as variants
    const variants = docs.map((doc) => transformDocument(doc, lang));

    // Create parent placeholder - will be enriched from MongoDB
    // The groupValue IS the parent_entity_code
    const parentPlaceholder: SolrProduct = {
      entity_code: parentEntityCode ?? '',
      is_parent: true,
      _needs_parent_enrichment: true, // Flag for enricher
      variants,
    } as SolrProduct & { _needs_parent_enrichment: boolean };

    results.push(parentPlaceholder);
  }

  return {
    results,
    numFound: groupData.ngroups ?? groupData.groups.length,
    matches: groupData.matches, // Total matching documents
    start: response?.start ?? 0,
    facet_results: transformFacets(facets, facet_counts, lang),
    grouped: {
      field: 'parent_entity_code',
      ngroups: groupData.ngroups ?? groupData.groups.length,
      matches: groupData.matches,
      groups: groupData.groups.map((group): ProductGroup => ({
        groupValue: group.groupValue ?? 'null',
        numFound: group.doclist.numFound,
        docs: group.doclist.docs.map((doc) => transformDocument(doc, lang)),
      })),
    },
  };
}

/**
 * Transform a single Solr document to SolrProduct
 * Returns full MongoDB-equivalent data structure
 */
export function transformDocument(
  doc: SolrRawDocument,
  lang: string
): SolrProduct {
  // Get multilingual fields for the requested language
  const name = doc[`name_text_${lang}`] || doc.sku || doc.entity_code;
  const slug = doc[`slug_text_${lang}`] || doc.sku?.toLowerCase();
  const description = doc[`description_text_${lang}`];
  const shortDescription = doc[`short_description_text_${lang}`];
  const longDescription = doc[`long_description_text_${lang}`];
  const features = doc[`features_text_${lang}`];
  const metaTitle = doc[`meta_title_text_${lang}`];
  const metaDescription = doc[`meta_description_text_${lang}`];
  const productStatusDescription = doc[`product_status_description_text_${lang}`];

  // Parse JSON fields - Full brand object with hierarchy
  const brand = parseJsonField<BrandData>(doc.brand_json, (data) => ({
    brand_id: data.brand_id,
    label: data.label || data.name,
    slug: data.slug,
    description: data.description,
    logo_url: data.logo_url,
    website_url: data.website_url,
    is_active: data.is_active,
    product_count: data.product_count,
    display_order: data.display_order,
    parent_brand_id: data.parent_brand_id,
    brand_family: data.brand_family,
    level: data.level,
    path: data.path,
    hierarchy: data.hierarchy,
  }));

  // Full category object with hierarchy
  const category = parseJsonField<CategoryData>(doc.category_json, (data) => ({
    category_id: data.category_id,
    name: getMultilingualValue(data.name, lang),
    slug: getMultilingualValue(data.slug, lang),
    details: getMultilingualValue(data.details, lang),
    image: data.image,
    icon: data.icon,
    breadcrumb: doc[`category_breadcrumb_${lang}`],
    description: data.description,
    is_active: data.is_active,
    product_count: data.product_count,
    display_order: data.display_order,
    parent_id: data.parent_id,
    level: data.level,
    path: data.path,
    hierarchy: data.hierarchy?.map((h: any) => ({
      ...h,
      name: getMultilingualValue(h.name, lang),
      slug: getMultilingualValue(h.slug, lang),
    })),
  }));

  // Full product type with features and hierarchy
  const productType = parseJsonField<ProductTypeData>(doc.product_type_json, (data) => ({
    product_type_id: data.product_type_id,
    name: getMultilingualValue(data.name, lang),
    slug: getMultilingualValue(data.slug, lang),
    description: data.description,
    is_active: data.is_active,
    product_count: data.product_count,
    display_order: data.display_order,
    technical_specifications: data.technical_specifications?.map((f: any) => ({
      key: f.key,
      label: getMultilingualValue(f.label, lang),
      value: f.value,
      unit: f.unit,
    })),
    parent_type_id: data.parent_type_id,
    level: data.level,
    path: data.path,
    hierarchy: data.hierarchy?.map((h: any) => ({
      ...h,
      name: getMultilingualValue(h.name, lang),
      slug: getMultilingualValue(h.slug, lang),
    })),
    inherited_technical_specifications: data.inherited_technical_specifications?.map((f: any) => ({
      key: f.key,
      label: getMultilingualValue(f.label, lang),
      unit: f.unit,
    })),
  }));

  // Full collections with hierarchy
  const collections = parseJsonField<CollectionData[]>(doc.collections_json, (data) =>
    Array.isArray(data)
      ? data.map((c) => ({
          collection_id: c.collection_id,
          name: getMultilingualValue(c.name, lang),
          slug: getMultilingualValue(c.slug, lang),
          description: c.description,
          is_active: c.is_active,
          product_count: c.product_count,
          display_order: c.display_order,
          parent_collection_id: c.parent_collection_id,
          level: c.level,
          path: c.path,
          hierarchy: c.hierarchy?.map((h: any) => ({
            ...h,
            name: getMultilingualValue(h.name, lang),
            slug: getMultilingualValue(h.slug, lang),
          })),
        }))
      : []
  );

  // Tags with group data
  const tags = parseJsonField<TagData[]>(doc.tags_json, (data) =>
    Array.isArray(data)
      ? data.map((t) => ({
          tag_id: t.tag_id,
          name: getMultilingualValue(t.name, lang),
          slug: t.slug,
          description: t.description,
          color: t.color,
          is_active: t.is_active,
          tag_category: t.tag_category,
          tag_group: t.tag_group,
          tag_group_data: t.tag_group_data ? {
            ...t.tag_group_data,
            group_name: getMultilingualValue(t.tag_group_data.group_name, lang),
          } : undefined,
        }))
      : undefined
  );

  // Media files (documents, videos, 3D models)
  const media = parseJsonField<MediaItem[]>(doc.media_json, (data) =>
    Array.isArray(data)
      ? data.map((m) => ({
          type: m.type,
          url: m.url,
          s3_key: m.s3_key,
          label: getMultilingualValue(m.label, lang),
          language: m.language,
          file_type: m.file_type,
          size_bytes: m.size_bytes,
          uploaded_at: m.uploaded_at,
          uploaded_by: m.uploaded_by,
          is_external_link: m.is_external_link,
          position: m.position,
        }))
      : undefined
  );

  // Product images array
  const images = parseJsonField<ImageAsset[]>(doc.images_json, (data) =>
    Array.isArray(data) ? data : undefined
  );

  // Gallery images
  const gallery = parseJsonField<GalleryImage[]>(doc.gallery_json, (data) =>
    Array.isArray(data) ? data : undefined
  );

  // Main image - prefer image_json, fall back to first image from images array
  let image = parseJsonField<ImageData>(doc.image_json, (data) => data);

  // If no image_json or it's a placeholder, construct from images[0]
  if ((!image || image.thumbnail?.includes('placeholder')) && images && images.length > 0) {
    const firstImage = images[0];
    image = {
      id: firstImage.cdn_key || firstImage.url,
      thumbnail: firstImage.url,
      medium: firstImage.url,
      large: firstImage.url,
      original: firstImage.url,
    };
  }

  // Technical Specifications for requested language
  const technical_specifications = parseJsonField<SpecificationData[]>(doc.technical_specifications_json, (data) => {
    if (!data) return undefined;
    // Technical specifications are stored per language: { it: [...], en: [...] }
    const langSpecs = data[lang] || data.it || data.en || (Array.isArray(data) ? data : undefined);
    return Array.isArray(langSpecs) ? langSpecs : undefined;
  });

  // Attributes for requested language
  // Handles multiple formats:
  // 1. Per-language format: { it: [...], en: [...] }
  // 2. Object format: { "key1": { label, value, order }, "key2": { label, value, order } }
  const attributes = parseJsonField<AttributeData[]>(doc.attributes_json, (data) => {
    if (!data) return undefined;

    // Check if it's per-language format
    if (data[lang] && Array.isArray(data[lang])) {
      return data[lang];
    }
    if (data.it && Array.isArray(data.it)) {
      return data.it;
    }
    if (data.en && Array.isArray(data.en)) {
      return data.en;
    }

    // Check if it's already an array
    if (Array.isArray(data)) {
      return data;
    }

    // Handle object format: { "key1": { label, value, order }, ... }
    // Convert to array format
    const keys = Object.keys(data);
    if (keys.length > 0 && typeof data[keys[0]] === 'object' && data[keys[0]].label !== undefined) {
      return keys
        .map((key) => ({
          key,
          label: data[key].label || key,
          value: data[key].value,
          order: data[key].order,
        }))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }

    return undefined;
  });

  // Promotions
  const promotions = parseJsonField<PromotionData[]>(doc.promotions_json, (data) =>
    Array.isArray(data)
      ? data.map((p) => ({
          ...p,
          label: getMultilingualValue(p.label, lang),
        }))
      : undefined
  );

  // Packaging options
  const packagingOptions = parseJsonField<PackagingData[]>(doc.packaging_json, (data) =>
    Array.isArray(data)
      ? data.map((p) => ({
          ...p,
          label: getMultilingualValue(p.label, lang),
        }))
      : undefined
  );

  // Parent product (self-contained)
  const parentProduct = parseJsonField<ParentProductData>(doc.parent_product_json, (data) => ({
    entity_code: data.entity_code,
    sku: data.sku,
    name: getMultilingualValue(data.name, lang),
    slug: getMultilingualValue(data.slug, lang),
    cover_image_url: data.cover_image_url,
    price: data.price,
    brand: data.brand,
    category: data.category ? {
      ...data.category,
      name: getMultilingualValue(data.category.name, lang),
      slug: getMultilingualValue(data.category.slug, lang),
    } : undefined,
  }));

  // Sibling variants (self-contained)
  const siblingVariants = parseJsonField<SiblingVariantData[]>(doc.sibling_variants_json, (data) =>
    Array.isArray(data)
      ? data.map((s) => ({
          entity_code: s.entity_code,
          sku: s.sku,
          name: getMultilingualValue(s.name, lang),
          variant_attributes: s.variant_attributes,
          cover_image_url: s.cover_image_url,
          price: s.price,
          stock_status: s.stock_status,
          is_active: s.is_active,
        }))
      : undefined
  );

  // Source info
  const source = parseJsonField<SourceData>(doc.source_json, (data) => data);

  // Analytics data
  const analytics: AnalyticsData | undefined = (
    doc.views_30d !== undefined ||
    doc.clicks_30d !== undefined ||
    doc.add_to_cart_30d !== undefined ||
    doc.conversions_30d !== undefined ||
    doc.priority_score !== undefined
  ) ? {
    views_30d: doc.views_30d,
    clicks_30d: doc.clicks_30d,
    add_to_cart_30d: doc.add_to_cart_30d,
    conversions_30d: doc.conversions_30d,
    priority_score: doc.priority_score,
  } : undefined;

  return {
    // Core identifiers
    id: doc.id,
    sku: doc.sku,
    entity_code: doc.entity_code,
    ean: doc.ean,

    // Multilingual text fields (resolved for requested language)
    name,
    slug,
    description,
    short_description: shortDescription,
    long_description: longDescription,
    features,

    // Inventory & pricing
    price: doc.price,
    vat_rate: doc.vat_rate,
    quantity: doc.quantity,
    sold: doc.sold,
    unit: doc.unit,
    stock_status: doc.stock_status,

    // Media - full arrays
    cover_image_url: doc.cover_image_url,
    image_count: doc.image_count,
    has_video: getBooleanValue(doc.has_video),
    image,
    images,
    gallery,
    media,

    // Taxonomy - full objects with hierarchies
    brand,
    category,
    product_type: productType,
    collections,
    tags,

    // Attributes & Technical Specifications
    attributes,
    technical_specifications,

    // Promotions & Packaging
    has_active_promo: getBooleanValue(doc.has_active_promo),
    promo_codes: doc.promo_codes,
    promotions,
    packaging_options: packagingOptions,

    // Variants
    is_parent: getBooleanValue(doc.is_parent),
    parent_entity_code: doc.parent_entity_code,
    parent_sku: doc.parent_sku,
    variants_sku: doc.variants_sku,
    variants_entity_code: doc.variants_entity_code,
    parent_product: parentProduct,
    sibling_variants: siblingVariants,
    include_faceting: getBooleanValue(doc.include_faceting),

    // Versioning & Status
    version: doc.version,
    isCurrent: getBooleanValue(doc.is_current),
    isCurrentPublished: getBooleanValue(doc.is_current_published),
    status: doc.status,
    product_status: doc.product_status,
    product_status_description: productStatusDescription,
    product_model: doc.product_model,

    // Quality & Analytics
    completeness_score: doc.completeness_score,
    priority_score: doc.priority_score,
    analytics,

    // SEO
    meta_title: metaTitle,
    meta_description: metaDescription,

    // Source
    source,

    // Dates
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    published_at: doc.published_at,
  };
}

// ============================================
// FACET RESPONSE TRANSFORMER
// ============================================

/**
 * Transform Solr facets to API facet format
 */
export function transformFacets(
  jsonFacets?: SolrSearchResponse['facets'],
  legacyFacets?: SolrSearchResponse['facet_counts'],
  lang?: string
): FacetResults | undefined {
  // Try JSON facet API format first
  if (jsonFacets) {
    return transformJsonFacets(jsonFacets, lang);
  }

  // Fall back to legacy facet format
  if (legacyFacets?.facet_fields) {
    return transformLegacyFacets(legacyFacets.facet_fields, lang);
  }

  return undefined;
}

/**
 * Transform facets only response
 */
export function transformFacetResponse(
  solrResponse: SolrSearchResponse,
  lang: string
): FacetResponse {
  const facetResults = transformFacets(
    solrResponse.facets,
    solrResponse.facet_counts,
    lang
  );

  return {
    facet_results: facetResults || {},
  };
}

/**
 * Enrich facet results with full entity data from MongoDB
 * Adds entity object to each facet value for brand, category, product_type, collection, tag
 * Also enriches dynamic attribute facets with labels from Solr attributes_json
 * @param facetResults - Facet results to enrich
 * @param lang - Language code for localized fields
 * @param tenantDb - Tenant database name (required for entity lookups)
 */
export async function enrichFacetResults(
  facetResults: FacetResults,
  lang?: string,
  tenantDb?: string
): Promise<FacetResults> {
  if (!facetResults || Object.keys(facetResults).length === 0) {
    return facetResults;
  }

  // tenantDb is required for entity lookups
  if (!tenantDb) {
    console.warn('[FacetEnricher] No tenantDb provided, returning facets without entity enrichment');
    return facetResults;
  }

  const effectiveLang = lang || 'it';

  try {
    // Check if we have any attribute facets to enrich
    const hasAttributeFacets = Object.keys(facetResults).some(
      (field) => field.startsWith('attribute_') && /_(s|b|f)$/.test(field)
    );

    // Load entity caches and attribute labels in parallel
    const [caches, attributeLabels] = await Promise.all([
      loadEntityCaches(tenantDb),
      hasAttributeFacets ? loadAttributeLabels(effectiveLang, tenantDb) : Promise.resolve(new Map<string, string>()),
    ]);

    // Enrich each facet field
    const enrichedResults: FacetResults = {};

    for (const [field, values] of Object.entries(facetResults)) {
      // Check if this is a dynamic attribute field
      const attributeSlug = extractAttributeSlug(field);

      if (attributeSlug) {
        // Enrich attribute facet with label from attributes_json
        const attrLabel = attributeLabels.get(attributeSlug);

        enrichedResults[field] = values.map((facetValue) => ({
          ...facetValue,
          key_label: attrLabel || facetValue.key_label,
        }));
      } else {
        // Enrich entity facet (brand, category, etc.)
        enrichedResults[field] = values.map((facetValue) => {
          const entity = getEntityData(field, facetValue.value, caches);

          if (entity) {
            const label = extractEntityLabel(entity, effectiveLang);

            return {
              ...facetValue,
              label: label || facetValue.label,
              entity: sanitizeEntity(entity),
            };
          }

          return facetValue;
        });
      }
    }

    return enrichedResults;
  } catch (error) {
    console.error('[FacetEnricher] Failed to enrich facets:', error);
    // Return original results if enrichment fails
    return facetResults;
  }
}

/**
 * Remove MongoDB internal fields from entity before returning
 */
function sanitizeEntity(entity: Record<string, unknown>): Record<string, unknown> {
  if (!entity) return entity;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entity)) {
    // Skip MongoDB internal fields
    if (key === '_id' || key === '__v') continue;
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Transform JSON API facets
 */
function transformJsonFacets(
  facets: SolrSearchResponse['facets'],
  lang?: string
): FacetResults {
  const results: FacetResults = {};

  if (!facets) return results;

  for (const [field, data] of Object.entries(facets)) {
    // Skip 'count' field
    if (field === 'count' || typeof data === 'number') continue;

    const buckets = (data as { buckets: { val: string; count: number }[] }).buckets;
    if (!buckets) continue;

    const config = FACET_FIELDS_CONFIG[field];
    const keyLabel = config?.label || field;

    results[field] = buckets.map((bucket) => ({
      value: String(bucket.val),
      count: bucket.count,
      label: getFacetValueLabel(field, String(bucket.val), lang),
      key_label: keyLabel,
    }));
  }

  return results;
}

/**
 * Transform legacy facet format (facet_fields)
 */
function transformLegacyFacets(
  facetFields: Record<string, (string | number)[]>,
  lang?: string
): FacetResults {
  const results: FacetResults = {};

  for (const [field, values] of Object.entries(facetFields)) {
    const config = FACET_FIELDS_CONFIG[field];
    const keyLabel = config?.label || field;

    const facetValues: FacetValue[] = [];

    // Legacy format: [value1, count1, value2, count2, ...]
    for (let i = 0; i < values.length; i += 2) {
      const value = String(values[i]);
      const count = Number(values[i + 1]);

      if (count > 0) {
        facetValues.push({
          value,
          count,
          label: getFacetValueLabel(field, value, lang),
          key_label: keyLabel,
        });
      }
    }

    if (facetValues.length > 0) {
      results[field] = facetValues;
    }
  }

  return results;
}

// ============================================
// FACET LABEL RESOLUTION
// ============================================

/**
 * Get display label for a facet value
 */
function getFacetValueLabel(
  field: string,
  value: string,
  lang?: string
): string {
  const config = FACET_FIELDS_CONFIG[field];

  // Check for static labels
  if (config?.labels && config.labels[value]) {
    return config.labels[value];
  }

  // For boolean fields
  if (config?.type === 'boolean') {
    const labels = config.labels || { true: 'Yes', false: 'No' };
    return labels[value] || value;
  }

  // Default: return value as-is (label will be resolved from JSON fields client-side)
  return value;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safely parse a JSON field
 */
function parseJsonField<T>(
  jsonString: string | undefined,
  transform: (data: any) => T
): T | undefined {
  if (!jsonString) return undefined;

  try {
    const data = JSON.parse(jsonString);
    return transform(data);
  } catch {
    return undefined;
  }
}

/**
 * Get boolean value from Solr field (handles array wrapper from multi-valued fields)
 */
function getBooleanValue(value: boolean | boolean[] | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Extract multilingual value from object or return string
 */
export function getMultilingualValue(
  value: string | Record<string, string> | undefined,
  lang: string
): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    return value;
  }

  return value[lang] || value.it || value.en || Object.values(value)[0];
}

// ============================================
// VARIANT ENRICHMENT
// ============================================

/**
 * Enrich products with their variant data from Solr
 * For products with variants_entity_code, fetches full variant products
 * and attaches them as a `variants` array
 *
 * Optimized: Uses filter query (fq) for efficient Solr lookup
 */
export async function enrichProductsWithVariants(
  products: SolrProduct[],
  lang: string
): Promise<SolrProduct[]> {
  // Collect all variant entity codes from parent products
  const allVariantCodes = new Set<string>();

  for (const product of products) {
    if (product.variants_entity_code?.length) {
      product.variants_entity_code.forEach(code => allVariantCodes.add(code));
    }
  }

  // No variants to fetch
  if (allVariantCodes.size === 0) {
    return products;
  }

  try {
    const solrClient = getSolrClient();
    const uniqueEntityCodes = Array.from(allVariantCodes);

    // Use filter query (fq) for efficient lookup - cached by Solr
    const response = await solrClient.search({
      query: '*:*',
      filter: [`entity_code:(${uniqueEntityCodes.join(' OR ')})`],
      limit: uniqueEntityCodes.length,
      fields: '*',
    });

    if (!response.response?.docs?.length) {
      return products;
    }

    // Build map: entity_code → transformed variant
    const variantsMap = new Map<string, SolrProduct>();
    for (const doc of response.response.docs) {
      variantsMap.set(doc.entity_code, transformDocument(doc, lang));
    }

    // Attach variants to parent products and propagate has_active_promo
    return products.map(product => {
      if (!product.variants_entity_code?.length) {
        return product;
      }

      const variants = product.variants_entity_code
        .map(code => variantsMap.get(code))
        .filter((v): v is SolrProduct => v !== undefined);

      if (variants.length === 0) {
        return product;
      }

      // Propagate has_active_promo: if any child has promo, parent has promo
      const childHasActivePromo = variants.some(v => v.has_active_promo === true);
      const hasActivePromo = product.has_active_promo || childHasActivePromo;

      // Merge parent media with variants if enabled
      const shouldShareImages = product.share_images_with_variants === true;
      const shouldShareMedia = product.share_media_with_variants === true;

      const mergedVariants = (shouldShareImages || shouldShareMedia)
        ? variants.map(v => mergeMediaFromParent(v, product, shouldShareImages, shouldShareMedia))
        : variants;

      return {
        ...product,
        variants: mergedVariants,
        has_active_promo: hasActivePromo,
      };
    });
  } catch (error) {
    console.error('[VariantEnricher] Failed to fetch variants:', error);
    return products;
  }
}
