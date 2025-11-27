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
