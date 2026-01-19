/**
 * Response Enricher
 * Enriches Solr search results with fresh data from MongoDB collections
 *
 * Priority: MongoDB data overrides Solr data for entities like brands, categories, etc.
 */

import { getPooledConnection } from '@/lib/db/connection';
import type { SolrProduct } from '@/lib/types/search';

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

interface CacheEntry<T> {
  data: Map<string, T>;
  timestamp: number;
}

// Tenant-aware entity caches
// Key format: `${tenantDb}:${collectionName}`
const entityCaches = new Map<string, CacheEntry<any>>();

function getCacheKey(tenantDb: string, collectionName: string): string {
  return `${tenantDb}:${collectionName}`;
}

function getCache(tenantDb: string, collectionName: string): CacheEntry<any> | undefined {
  return entityCaches.get(getCacheKey(tenantDb, collectionName));
}

function setCache(tenantDb: string, collectionName: string, entry: CacheEntry<any>): void {
  entityCaches.set(getCacheKey(tenantDb, collectionName), entry);
}

// ============================================
// GENERIC CACHE LOADER
// ============================================

async function loadEntityCache(
  tenantDb: string,
  collectionName: string,
  idField: string
): Promise<Map<string, any>> {
  const now = Date.now();

  // Return cached if still valid
  const cache = getCache(tenantDb, collectionName);
  if (cache && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache.data;
  }

  const connection = await getPooledConnection(tenantDb);
  const db = connection.db;

  if (!db) {
    console.warn(`[Enricher] MongoDB not connected, skipping ${collectionName} enrichment`);
    return new Map();
  }

  const docs = await db.collection(collectionName).find({}).toArray();
  const map = new Map<string, any>();

  for (const doc of docs) {
    const id = doc[idField];
    if (id) {
      map.set(id, doc);
    }
  }

  setCache(tenantDb, collectionName, { data: map, timestamp: now });
  return map;
}

// ============================================
// ENTITY LOADERS
// ============================================

export async function loadBrands(tenantDb: string): Promise<Map<string, any>> {
  return loadEntityCache(tenantDb, 'brands', 'brand_id');
}

export async function loadCategories(tenantDb: string): Promise<Map<string, any>> {
  return loadEntityCache(tenantDb, 'categories', 'category_id');
}

export async function loadCollections(tenantDb: string): Promise<Map<string, any>> {
  return loadEntityCache(tenantDb, 'collections', 'collection_id');
}

export async function loadProductTypes(tenantDb: string): Promise<Map<string, any>> {
  return loadEntityCache(tenantDb, 'producttypes', 'product_type_id');
}

export async function loadTags(tenantDb: string): Promise<Map<string, any>> {
  return loadEntityCache(tenantDb, 'tags', 'tag_id');
}

// ============================================
// MEDIA MERGE FOR VARIANTS
// ============================================

/**
 * Merge parent media with variant media.
 * Strategy: Variant's own content first, then parent's content appended.
 * Deduplicates by URL.
 *
 * @param variant - The variant product
 * @param parent - The parent product
 * @param shareImages - Whether to merge images
 * @param shareMedia - Whether to merge additional media (docs, videos, 3D)
 */
export function mergeMediaFromParent(
  variant: SolrProduct,
  parent: SolrProduct,
  shareImages: boolean,
  shareMedia: boolean
): SolrProduct {
  if (!parent || (!shareImages && !shareMedia)) return variant;

  const result = { ...variant };

  // Merge images (if shareImages enabled)
  if (shareImages && parent.images?.length) {
    let mergedImages = variant.images || [];
    const existingUrls = new Set(mergedImages.map(img => img.url));
    const parentImages = parent.images.filter(img => !existingUrls.has(img.url));
    mergedImages = [...mergedImages, ...parentImages];
    result.images = mergedImages.length > 0 ? mergedImages : undefined;
    result.image_count = mergedImages.length;

    // Also merge gallery if present
    if (parent.gallery?.length) {
      let mergedGallery = variant.gallery || [];
      const existingGalleryUrls = new Set(mergedGallery.map(g => g.url));
      const parentGallery = parent.gallery.filter(g => !existingGalleryUrls.has(g.url));
      mergedGallery = [...mergedGallery, ...parentGallery];
      result.gallery = mergedGallery.length > 0 ? mergedGallery : undefined;
    }
  }

  // Merge additional media (if shareMedia enabled)
  if (shareMedia && parent.media?.length) {
    let mergedMedia = variant.media || [];
    const existingUrls = new Set(mergedMedia.map(m => m.url));
    const parentMedia = parent.media.filter(m => !existingUrls.has(m.url));
    mergedMedia = [...mergedMedia, ...parentMedia];
    result.media = mergedMedia.length > 0 ? mergedMedia : undefined;
  }

  return result;
}

/**
 * Product fields to enrich from MongoDB
 * These fields change frequently and should come from MongoDB (source of truth)
 */
interface ProductEnrichmentData {
  entity_code?: string;
  attributes?: any;
  images?: any[];
  media?: any[];
  share_images_with_variants?: boolean;
  share_media_with_variants?: boolean;
}

/**
 * Load product data from MongoDB by entity_codes for enrichment
 * Returns Map<entity_code, ProductEnrichmentData>
 */
export async function loadProductData(tenantDb: string, entityCodes: string[]): Promise<Map<string, ProductEnrichmentData>> {
  if (!entityCodes.length) {
    return new Map();
  }

  const connection = await getPooledConnection(tenantDb);
  const db = connection.db;

  if (!db) {
    console.warn('[Enricher] MongoDB not connected, skipping product data enrichment');
    return new Map();
  }

  const products = await db.collection('pimproducts')
    .find({ entity_code: { $in: entityCodes }, isCurrent: true })
    .project({ entity_code: 1, attributes: 1, images: 1, media: 1, share_images_with_variants: 1, share_media_with_variants: 1 })
    .toArray();

  const map = new Map<string, ProductEnrichmentData>();
  for (const product of products) {
    if (product.entity_code) {
      map.set(product.entity_code, {
        entity_code: product.entity_code,
        attributes: product.attributes,
        images: product.images,
        media: product.media,
        share_images_with_variants: product.share_images_with_variants,
        share_media_with_variants: product.share_media_with_variants,
      });
    }
  }

  return map;
}

// ============================================
// ENTITY ENRICHERS
// ============================================

/**
 * Merge MongoDB entity data with Solr data (MongoDB takes priority)
 */
function mergeEntity(mongoData: any, solrData: any): any {
  if (!mongoData) return solrData;
  if (!solrData) return mongoData;

  // MongoDB data takes priority, use Solr as fallback
  const merged: any = { ...solrData };

  for (const key of Object.keys(mongoData)) {
    const mongoValue = mongoData[key];
    // Skip internal MongoDB fields
    if (key === '_id') continue;

    // Use MongoDB value if it exists and is not empty
    if (mongoValue !== undefined && mongoValue !== null) {
      if (Array.isArray(mongoValue)) {
        // Use MongoDB array if it has items
        if (mongoValue.length > 0) {
          merged[key] = mongoValue;
        }
      } else {
        merged[key] = mongoValue;
      }
    }
  }

  return merged;
}

function enrichBrand(solrBrand: any, brandsMap: Map<string, any>): any {
  if (!solrBrand?.brand_id) return solrBrand;
  const mongoBrand = brandsMap.get(solrBrand.brand_id);
  return mergeEntity(mongoBrand, solrBrand);
}

function enrichCategory(solrCategory: any, categoriesMap: Map<string, any>): any {
  if (!solrCategory?.category_id) return solrCategory;
  const mongoCategory = categoriesMap.get(solrCategory.category_id);
  return mergeEntity(mongoCategory, solrCategory);
}

function enrichCollection(solrCollection: any, collectionsMap: Map<string, any>): any {
  if (!solrCollection?.collection_id) return solrCollection;
  const mongoCollection = collectionsMap.get(solrCollection.collection_id);
  return mergeEntity(mongoCollection, solrCollection);
}

function enrichProductType(solrProductType: any, productTypesMap: Map<string, any>): any {
  if (!solrProductType?.product_type_id) return solrProductType;
  const mongoProductType = productTypesMap.get(solrProductType.product_type_id);
  return mergeEntity(mongoProductType, solrProductType);
}

function enrichTag(solrTag: any, tagsMap: Map<string, any>): any {
  if (!solrTag?.tag_id) return solrTag;
  const mongoTag = tagsMap.get(solrTag.tag_id);
  return mergeEntity(mongoTag, solrTag);
}

function enrichCollections(solrCollections: any[], collectionsMap: Map<string, any>): any[] {
  if (!solrCollections?.length) return solrCollections;
  return solrCollections.map(c => enrichCollection(c, collectionsMap));
}

function enrichTags(solrTags: any[], tagsMap: Map<string, any>): any[] {
  if (!solrTags?.length) return solrTags;
  return solrTags.map(t => enrichTag(t, tagsMap));
}

// ============================================
// MAIN ENRICHER
// ============================================

/**
 * Get localized string from multilingual object
 */
function getLocalizedString(value: any, lang: string): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value[lang] || value.it || value.en || Object.values(value)[0];
}

/**
 * Extract attributes for the requested language
 * MongoDB stores: { it: [...], en: [...] } or flat { slug: { label, value, order } }
 */
function getLocalizedAttributes(attributes: any, lang: string): any {
  if (!attributes) return undefined;

  // Check if it's language-keyed format: { it: [...], en: [...] }
  if (attributes[lang]) {
    return attributes[lang];
  }
  // Fallback to Italian, then English, then first available
  if (attributes.it) {
    return attributes.it;
  }
  if (attributes.en) {
    return attributes.en;
  }

  // Check if it's flat format: { slug: { label, value, order } }
  // This format doesn't need language extraction
  const firstValue = Object.values(attributes)[0];
  if (firstValue && typeof firstValue === 'object' && 'label' in (firstValue as any)) {
    return attributes; // Already flat format
  }

  return attributes;
}

/**
 * Filter attributes to remove those marked hide_in_commerce
 * Only visible attributes (hide_in_commerce !== true) are returned
 */
function filterVisibleAttributes(attributes: any): any {
  if (!attributes || typeof attributes !== 'object') return attributes;

  const filtered: any = {};

  for (const [slug, attrData] of Object.entries(attributes)) {
    if (!attrData || typeof attrData !== 'object') {
      filtered[slug] = attrData;
      continue;
    }

    // Check hide_in_commerce flag (default: false = visible)
    const hideInCommerce = (attrData as any).hide_in_commerce ?? false;

    if (!hideInCommerce) {
      // Remove hide_in_commerce from output (internal PIM only)
      const { hide_in_commerce, ...cleanAttr } = attrData as any;
      filtered[slug] = cleanAttr;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Localize media array - extract labels for requested language
 */
function getLocalizedMedia(media: any[], lang: string): any[] {
  if (!media?.length) return media;

  return media.map(item => ({
    ...item,
    label: getLocalizedString(item.label, lang),
  }));
}

/**
 * Enrich search results with fresh data from MongoDB
 * Call this after transformSearchResponse
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 * @param results - Search results to enrich
 * @param lang - Language code for localized fields (default: 'it')
 */
export async function enrichSearchResults(tenantDb: string, results: any[], lang: string = 'it'): Promise<any[]> {
  if (!results?.length) {
    return results;
  }

  try {
    // Collect entity_codes for product data lookup
    const entityCodes = results
      .map(r => r.entity_code)
      .filter((code): code is string => !!code);

    // Collect parent entity codes from variants (for media merge)
    const parentEntityCodes = results
      .filter(r => r.parent_entity_code && !r.is_parent)
      .map(r => r.parent_entity_code)
      .filter((code): code is string => !!code);

    // Combine all entity codes (products + parents)
    const allEntityCodes = Array.from(new Set([...entityCodes, ...parentEntityCodes]));

    // Load all entity caches and product data in parallel
    const [brandsMap, categoriesMap, collectionsMap, productTypesMap, tagsMap, productDataMap] = await Promise.all([
      loadBrands(tenantDb),
      loadCategories(tenantDb),
      loadCollections(tenantDb),
      loadProductTypes(tenantDb),
      loadTags(tenantDb),
      loadProductData(tenantDb, allEntityCodes),
    ]);

    // Enrich each result
    return results.map(result => {
      const productData = productDataMap.get(result.entity_code);

      // Get localized data from MongoDB
      const mongoAttributes = productData?.attributes
        ? filterVisibleAttributes(getLocalizedAttributes(productData.attributes, lang))
        : undefined;
      const mongoMedia = productData?.media
        ? getLocalizedMedia(productData.media, lang)
        : undefined;

      // Determine has_active_promo (prefer Solr value, which is indexed)
      const hasActivePromo = result.has_active_promo ?? false;

      let enrichedResult: SolrProduct = {
        ...result,
        // Ensure has_active_promo is always set
        has_active_promo: hasActivePromo,
        brand: enrichBrand(result.brand, brandsMap),
        category: enrichCategory(result.category, categoriesMap),
        collections: enrichCollections(result.collections, collectionsMap),
        product_type: enrichProductType(result.product_type, productTypesMap),
        tags: enrichTags(result.tags, tagsMap),
        // Replace Solr data with MongoDB data (source of truth, localized)
        attributes: mongoAttributes || result.attributes,
        images: productData?.images || result.images,
        media: mongoMedia || result.media,
        // Remove gallery (doesn't exist in MongoDB schema)
        gallery: undefined,
      };

      // For variants, check if parent has share_images/media_with_variants enabled
      if (result.parent_entity_code && !result.is_parent) {
        const parentData = productDataMap.get(result.parent_entity_code);
        if (parentData) {
          const shouldShareImages = parentData.share_images_with_variants === true;
          const shouldShareMedia = parentData.share_media_with_variants === true;

          if (shouldShareImages || shouldShareMedia) {
            // Build parent-like object for merge function
            const parentForMerge = {
              entity_code: parentData.entity_code || result.parent_entity_code,
              images: parentData.images,
              media: parentData.media ? getLocalizedMedia(parentData.media, lang) : undefined,
              gallery: undefined,
            } as SolrProduct;
            enrichedResult = mergeMediaFromParent(enrichedResult, parentForMerge, shouldShareImages, shouldShareMedia);
          }
        }
      }

      return enrichedResult;
    });
  } catch (error) {
    console.error('[Enricher] Failed to enrich results:', error);
    // Return original results if enrichment fails
    return results;
  }
}

// ============================================
// VARIANT GROUPED RESULTS ENRICHMENT
// ============================================

/**
 * Enrich variant grouped search results
 * For group_variants: true - fetch parent from MongoDB and enrich variants
 *
 * @param tenantDb - Tenant database name (e.g., "vinc-hidros-it")
 * @param results - Results with _needs_parent_enrichment flag and variants array
 * @param lang - Language code for localized fields
 */
export async function enrichVariantGroupedResults(tenantDb: string, results: any[], lang: string = 'it'): Promise<any[]> {
  if (!results?.length) {
    return results;
  }

  try {
    // Collect ALL entity_codes: parents + all variants
    const parentEntityCodes: string[] = [];
    const variantEntityCodes: string[] = [];

    for (const result of results) {
      if (result.entity_code) {
        parentEntityCodes.push(result.entity_code);
      }
      if (result.variants?.length) {
        for (const variant of result.variants) {
          if (variant.entity_code) {
            variantEntityCodes.push(variant.entity_code);
          }
        }
      }
    }

    const allEntityCodes = [...parentEntityCodes, ...variantEntityCodes];

    // Load entity caches and ALL product data in parallel
    const [brandsMap, categoriesMap, collectionsMap, productTypesMap, tagsMap, productDataMap] = await Promise.all([
      loadBrands(tenantDb),
      loadCategories(tenantDb),
      loadCollections(tenantDb),
      loadProductTypes(tenantDb),
      loadTags(tenantDb),
      loadFullProductData(tenantDb, allEntityCodes),
    ]);

    // Helper to enrich a single product
    const enrichProduct = (product: any) => {
      const productData = productDataMap.get(product.entity_code);

      if (!productData) {
        // No MongoDB data found, return as-is with entity enrichment
        // Keep has_active_promo from Solr or default to false
        return {
          ...product,
          has_active_promo: product.has_active_promo ?? false,
          brand: enrichBrand(product.brand, brandsMap),
          category: enrichCategory(product.category, categoriesMap),
          collections: enrichCollections(product.collections, collectionsMap),
          product_type: enrichProductType(product.product_type, productTypesMap),
          tags: enrichTags(product.tags, tagsMap),
        };
      }

      // Get localized data from MongoDB
      const mongoAttributes = productData.attributes
        ? filterVisibleAttributes(getLocalizedAttributes(productData.attributes, lang))
        : undefined;
      const mongoMedia = productData.media
        ? getLocalizedMedia(productData.media, lang)
        : undefined;

      // Determine has_active_promo from MongoDB (check promotions array if not explicitly set)
      const hasActivePromo = productData.has_active_promo
        ?? productData.promotions?.some((p: any) => p.is_active)
        ?? product.has_active_promo
        ?? false;

      // Merge MongoDB data into product
      return {
        ...product,
        // Core fields from MongoDB
        sku: productData.sku || product.sku,
        ean: productData.ean || product.ean,
        name: getLocalizedName(productData, lang) || product.name,
        short_description: getLocalizedShortDescription(productData, lang) || product.short_description,
        description: getLocalizedDescription(productData, lang) || product.description,
        slug: productData.slug || product.slug,
        // Pricing from MongoDB
        price: productData.sell_price ?? product.price,
        list_price: productData.list_price ?? product.list_price,
        // Parent/variant info
        is_parent: productData.is_parent ?? product.is_parent,
        parent_entity_code: productData.parent_entity_code || product.parent_entity_code,
        parent_sku: productData.parent_sku || product.parent_sku,
        variants_entity_code: productData.variants_entity_code || product.variants_entity_code,
        variants_sku: productData.variants_sku || product.variants_sku,
        share_images_with_variants: productData.share_images_with_variants ?? product.share_images_with_variants,
        share_media_with_variants: productData.share_media_with_variants ?? product.share_media_with_variants,
        // Promotions & Packaging
        has_active_promo: hasActivePromo,
        promotions: productData.promotions || product.promotions,
        packaging_options: productData.packaging_options || product.packaging_options,
        // Media
        cover_image_url: productData.cover_image_url || product.cover_image_url,
        images: productData.images || product.images,
        media: mongoMedia || product.media,
        // Attributes
        attributes: mongoAttributes || product.attributes,
        // Entity relations enriched
        brand: enrichBrand(productData.brand || product.brand, brandsMap),
        category: enrichCategory(productData.category || product.category, categoriesMap),
        collections: enrichCollections(productData.collections || product.collections, collectionsMap),
        product_type: enrichProductType(productData.product_type || product.product_type, productTypesMap),
        tags: enrichTags(productData.tags || product.tags, tagsMap),
        // Clean up
        gallery: undefined,
        _needs_parent_enrichment: undefined,
      };
    };

    // Enrich each result (parent) and its variants
    return results.map(result => {
      // Enrich the parent
      const enrichedParent = enrichProduct(result);

      // Enrich variants if present
      if (result.variants?.length) {
        enrichedParent.variants = result.variants.map((variant: any) => enrichProduct(variant));

        // Propagate has_active_promo: if any child has promo, parent has promo
        const childHasActivePromo = enrichedParent.variants.some((v: any) => v.has_active_promo === true);
        if (childHasActivePromo) {
          enrichedParent.has_active_promo = true;
        }

        // Merge parent media with variants if enabled
        const shouldShareImages = enrichedParent.share_images_with_variants === true;
        const shouldShareMedia = enrichedParent.share_media_with_variants === true;

        if (shouldShareImages || shouldShareMedia) {
          enrichedParent.variants = enrichedParent.variants.map((v: SolrProduct) =>
            mergeMediaFromParent(v, enrichedParent, shouldShareImages, shouldShareMedia)
          );
        }
      }

      return enrichedParent;
    });
  } catch (error) {
    console.error('[Enricher] Failed to enrich variant grouped results:', error);
    return results;
  }
}

/**
 * Load full product data from MongoDB (all fields needed for parent enrichment)
 */
async function loadFullProductData(tenantDb: string, entityCodes: string[]): Promise<Map<string, any>> {
  if (!entityCodes.length) {
    return new Map();
  }

  const connection = await getPooledConnection(tenantDb);
  const db = connection.db;

  if (!db) {
    console.warn('[Enricher] MongoDB not connected, skipping full product data enrichment');
    return new Map();
  }

  const products = await db.collection('pimproducts')
    .find({ entity_code: { $in: entityCodes }, isCurrent: true })
    .toArray();

  const map = new Map<string, any>();
  for (const product of products) {
    if (product.entity_code) {
      map.set(product.entity_code, product);
    }
  }

  return map;
}

/**
 * Get localized name from product
 */
function getLocalizedName(product: any, lang: string): string | undefined {
  return product.name?.[lang] || product.name?.it || Object.values(product.name || {})[0] as string;
}

/**
 * Get localized short description from product
 */
function getLocalizedShortDescription(product: any, lang: string): string | undefined {
  return product.short_description?.[lang] || product.short_description?.it;
}

/**
 * Get localized description from product
 */
function getLocalizedDescription(product: any, lang: string): string | undefined {
  return product.description?.[lang] || product.description?.it;
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear all entity caches for all tenants
 */
export function clearAllCaches(): void {
  entityCaches.clear();
}

/**
 * Clear all entity caches for a specific tenant
 */
export function clearTenantCaches(tenantDb: string): void {
  Array.from(entityCaches.keys())
    .filter(key => key.startsWith(`${tenantDb}:`))
    .forEach(key => entityCaches.delete(key));
}

export function clearBrandsCache(tenantDb?: string): void {
  if (tenantDb) {
    entityCaches.delete(getCacheKey(tenantDb, 'brands'));
  } else {
    // Clear brands for all tenants
    Array.from(entityCaches.keys())
      .filter(key => key.endsWith(':brands'))
      .forEach(key => entityCaches.delete(key));
  }
}

export function clearCategoriesCache(tenantDb?: string): void {
  if (tenantDb) {
    entityCaches.delete(getCacheKey(tenantDb, 'categories'));
  } else {
    Array.from(entityCaches.keys())
      .filter(key => key.endsWith(':categories'))
      .forEach(key => entityCaches.delete(key));
  }
}

export function clearCollectionsCache(tenantDb?: string): void {
  if (tenantDb) {
    entityCaches.delete(getCacheKey(tenantDb, 'collections'));
  } else {
    Array.from(entityCaches.keys())
      .filter(key => key.endsWith(':collections'))
      .forEach(key => entityCaches.delete(key));
  }
}

export function clearProductTypesCache(tenantDb?: string): void {
  if (tenantDb) {
    entityCaches.delete(getCacheKey(tenantDb, 'producttypes'));
  } else {
    Array.from(entityCaches.keys())
      .filter(key => key.endsWith(':producttypes'))
      .forEach(key => entityCaches.delete(key));
  }
}

export function clearTagsCache(tenantDb?: string): void {
  if (tenantDb) {
    entityCaches.delete(getCacheKey(tenantDb, 'tags'));
  } else {
    Array.from(entityCaches.keys())
      .filter(key => key.endsWith(':tags'))
      .forEach(key => entityCaches.delete(key));
  }
}
