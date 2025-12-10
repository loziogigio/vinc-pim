/**
 * Response Enricher
 * Enriches Solr search results with fresh data from MongoDB collections
 *
 * Priority: MongoDB data overrides Solr data for entities like brands, categories, etc.
 */

import { connectToDatabase } from '@/lib/db/connection';
import mongoose from 'mongoose';

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

interface CacheEntry<T> {
  data: Map<string, T>;
  timestamp: number;
}

// Entity caches
let brandsCache: CacheEntry<any> | null = null;
let categoriesCache: CacheEntry<any> | null = null;
let collectionsCache: CacheEntry<any> | null = null;
let productTypesCache: CacheEntry<any> | null = null;
let tagsCache: CacheEntry<any> | null = null;

// ============================================
// GENERIC CACHE LOADER
// ============================================

async function loadEntityCache(
  collectionName: string,
  idField: string,
  cache: CacheEntry<any> | null,
  setCache: (entry: CacheEntry<any>) => void
): Promise<Map<string, any>> {
  const now = Date.now();

  // Return cached if still valid
  if (cache && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache.data;
  }

  await connectToDatabase();
  const db = mongoose.connection.db;

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

  setCache({ data: map, timestamp: now });
  return map;
}

// ============================================
// ENTITY LOADERS
// ============================================

export async function loadBrands(): Promise<Map<string, any>> {
  return loadEntityCache('brands', 'brand_id', brandsCache, (c) => { brandsCache = c; });
}

export async function loadCategories(): Promise<Map<string, any>> {
  return loadEntityCache('categories', 'category_id', categoriesCache, (c) => { categoriesCache = c; });
}

export async function loadCollections(): Promise<Map<string, any>> {
  return loadEntityCache('collections', 'collection_id', collectionsCache, (c) => { collectionsCache = c; });
}

export async function loadProductTypes(): Promise<Map<string, any>> {
  return loadEntityCache('producttypes', 'product_type_id', productTypesCache, (c) => { productTypesCache = c; });
}

export async function loadTags(): Promise<Map<string, any>> {
  return loadEntityCache('tags', 'tag_id', tagsCache, (c) => { tagsCache = c; });
}

/**
 * Product fields to enrich from MongoDB
 * These fields change frequently and should come from MongoDB (source of truth)
 */
interface ProductEnrichmentData {
  attributes?: any;
  images?: any[];
  media?: any[];
}

/**
 * Load product data from MongoDB by entity_codes for enrichment
 * Returns Map<entity_code, ProductEnrichmentData>
 */
export async function loadProductData(entityCodes: string[]): Promise<Map<string, ProductEnrichmentData>> {
  if (!entityCodes.length) {
    return new Map();
  }

  await connectToDatabase();
  const db = mongoose.connection.db;

  if (!db) {
    console.warn('[Enricher] MongoDB not connected, skipping product data enrichment');
    return new Map();
  }

  const products = await db.collection('pimproducts')
    .find({ entity_code: { $in: entityCodes }, isCurrent: true })
    .project({ entity_code: 1, attributes: 1, images: 1, media: 1 })
    .toArray();

  const map = new Map<string, ProductEnrichmentData>();
  for (const product of products) {
    if (product.entity_code) {
      map.set(product.entity_code, {
        attributes: product.attributes,
        images: product.images,
        media: product.media,
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
 * @param lang - Language code for localized fields (default: 'it')
 */
export async function enrichSearchResults(results: any[], lang: string = 'it'): Promise<any[]> {
  if (!results?.length) {
    return results;
  }

  try {
    // Collect entity_codes for product data lookup
    const entityCodes = results
      .map(r => r.entity_code)
      .filter((code): code is string => !!code);

    // Load all entity caches and product data in parallel
    const [brandsMap, categoriesMap, collectionsMap, productTypesMap, tagsMap, productDataMap] = await Promise.all([
      loadBrands(),
      loadCategories(),
      loadCollections(),
      loadProductTypes(),
      loadTags(),
      loadProductData(entityCodes),
    ]);

    // Enrich each result
    return results.map(result => {
      const productData = productDataMap.get(result.entity_code);

      // Get localized data from MongoDB
      const mongoAttributes = productData?.attributes
        ? getLocalizedAttributes(productData.attributes, lang)
        : undefined;
      const mongoMedia = productData?.media
        ? getLocalizedMedia(productData.media, lang)
        : undefined;

      return {
        ...result,
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
 * @param results - Results with _needs_parent_enrichment flag and variants array
 * @param lang - Language code for localized fields
 */
export async function enrichVariantGroupedResults(results: any[], lang: string = 'it'): Promise<any[]> {
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
      loadBrands(),
      loadCategories(),
      loadCollections(),
      loadProductTypes(),
      loadTags(),
      loadFullProductData(allEntityCodes),
    ]);

    // Helper to enrich a single product
    const enrichProduct = (product: any) => {
      const productData = productDataMap.get(product.entity_code);

      if (!productData) {
        // No MongoDB data found, return as-is with entity enrichment
        return {
          ...product,
          brand: enrichBrand(product.brand, brandsMap),
          category: enrichCategory(product.category, categoriesMap),
          collections: enrichCollections(product.collections, collectionsMap),
          product_type: enrichProductType(product.product_type, productTypesMap),
          tags: enrichTags(product.tags, tagsMap),
        };
      }

      // Get localized data from MongoDB
      const mongoAttributes = productData.attributes
        ? getLocalizedAttributes(productData.attributes, lang)
        : undefined;
      const mongoMedia = productData.media
        ? getLocalizedMedia(productData.media, lang)
        : undefined;

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
async function loadFullProductData(entityCodes: string[]): Promise<Map<string, any>> {
  if (!entityCodes.length) {
    return new Map();
  }

  await connectToDatabase();
  const db = mongoose.connection.db;

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
 * Clear all entity caches (call when entities are updated)
 */
export function clearAllCaches(): void {
  brandsCache = null;
  categoriesCache = null;
  collectionsCache = null;
  productTypesCache = null;
  tagsCache = null;
}

export function clearBrandsCache(): void {
  brandsCache = null;
}

export function clearCategoriesCache(): void {
  categoriesCache = null;
}

export function clearCollectionsCache(): void {
  collectionsCache = null;
}

export function clearProductTypesCache(): void {
  productTypesCache = null;
}

export function clearTagsCache(): void {
  tagsCache = null;
}
