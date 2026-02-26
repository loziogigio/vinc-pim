/**
 * Response Enricher
 * Enriches Solr search results with fresh data from MongoDB collections
 *
 * Priority: MongoDB data overrides Solr data for entities like brands, categories, etc.
 */

import { getPooledConnection } from '@/lib/db/connection';
import type { SolrProduct, PackagingData } from '@/lib/types/search';

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

/**
 * Load ProductTypes keyed by code (for product_type_code facet)
 * Same collection as loadProductTypes but keyed by 'code' field
 */
export async function loadProductTypesByCode(tenantDb: string): Promise<Map<string, any>> {
  const now = Date.now();
  const cacheKey = 'producttypes_by_code';

  // Return cached if still valid
  const cache = getCache(tenantDb, cacheKey);
  if (cache && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache.data;
  }

  const connection = await getPooledConnection(tenantDb);
  const db = connection.db;

  if (!db) {
    console.warn('[Enricher] MongoDB not connected, skipping productTypes by code enrichment');
    return new Map();
  }

  // Load from producttypes collection but key by 'code'
  const docs = await db.collection('producttypes').find({ code: { $exists: true, $nin: [null, ''] } }).toArray();
  const map = new Map<string, any>();

  for (const doc of docs) {
    if (doc.code) {
      map.set(doc.code, doc);
    }
  }

  setCache(tenantDb, cacheKey, { data: map, timestamp: now });
  return map;
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
  technical_specifications?: any;
  images?: any[];
  media?: any[];
  share_images_with_variants?: boolean;
  share_media_with_variants?: boolean;
  packaging_options?: PackagingData[];
  promotions?: any[];
  vat_rate?: number;
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
    .project({ entity_code: 1, attributes: 1, technical_specifications: 1, images: 1, media: 1, share_images_with_variants: 1, share_media_with_variants: 1, packaging_options: 1, promotions: 1, pricing: 1 })
    .toArray();

  const map = new Map<string, ProductEnrichmentData>();
  for (const product of products) {
    if (product.entity_code) {
      map.set(product.entity_code, {
        entity_code: product.entity_code,
        attributes: product.attributes,
        technical_specifications: product.technical_specifications,
        images: product.images,
        media: product.media,
        share_images_with_variants: product.share_images_with_variants,
        share_media_with_variants: product.share_media_with_variants,
        packaging_options: product.packaging_options,
        promotions: product.promotions,
        vat_rate: product.pricing?.vat_rate,
      });
    }
  }

  return map;
}

/**
 * Compute per-packaging promotions from product-level promotions.
 * Each packaging option gets the promotions that target it:
 * - target_pkg_ids empty/undefined → all sellable packaging (is_sellable !== false)
 * - target_pkg_ids set → only those specific pkg_ids
 */
export function embedPromotionsInPackaging(
  packagingOptions: PackagingData[] | undefined,
  promotions: any[] | undefined
): PackagingData[] | undefined {
  if (!packagingOptions?.length || !promotions?.length) return packagingOptions;

  return packagingOptions.map((pkg: any) => ({
    ...pkg,
    promotions: promotions.filter((promo: any) => {
      if (!promo.target_pkg_ids || promo.target_pkg_ids.length === 0) {
        return pkg.is_sellable !== false;
      }
      return promo.target_pkg_ids.includes(pkg.pkg_id);
    }),
  }));
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
// PACKAGING PRICE CALCULATION (BI-DIRECTIONAL)
// ============================================

/**
 * Build text_discount string from discount percentages
 * Examples:
 *   - buildTextDiscount(50) → "-50%"
 *   - buildTextDiscount(50, 10) → "-50% -10%"
 *   - buildTextDiscount(50, 10, 20) → "-50% -10% -20%"
 */
function buildTextDiscount(...discounts: (number | undefined | null)[]): string | undefined {
  const validDiscounts = discounts.filter((d): d is number => d != null && d > 0);
  if (validDiscounts.length === 0) return undefined;
  return validDiscounts.map(d => `-${d}%`).join(" ");
}

/**
 * Calculate prices for packaging options (bi-directional)
 *
 * Supports two pricing sources:
 * 1. Total price stored (list, retail, sale) → calculate unit prices
 * 2. Unit price stored (list_unit, retail_unit, sale_unit) → calculate total prices
 *
 * Also calculates text_discount for pricing and promotions:
 * - pricing.text_discount: "-50%" or "-50% -10%" (from list_discount_pct + sale_discount_pct)
 * - promotion.text_discount: "-50% -20%" (pricing discounts + promo discount_percentage)
 *
 * Formula:
 * - unit_price = total_price / qty
 * - total_price = unit_price * qty
 */
function enrichPackagingWithUnitPrices(
  packagingOptions: PackagingData[] | undefined
): PackagingData[] | undefined {
  if (!packagingOptions?.length) return packagingOptions;

  return packagingOptions.map(pkg => {
    const pricing = pkg.pricing;
    if (!pricing) return pkg;

    const qty = pkg.qty || 1; // Avoid division by zero
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Calculate list prices (bi-directional)
    let list = pricing.list;
    let listUnit = pricing.list_unit;
    if (list != null && listUnit == null && qty > 0) {
      // Total stored → calculate unit
      listUnit = round2(list / qty);
    } else if (listUnit != null && list == null) {
      // Unit stored → calculate total
      list = round2(listUnit * qty);
    }

    // Calculate retail prices (bi-directional)
    let retail = pricing.retail;
    let retailUnit = pricing.retail_unit;
    if (retail != null && retailUnit == null && qty > 0) {
      retailUnit = round2(retail / qty);
    } else if (retailUnit != null && retail == null) {
      retail = round2(retailUnit * qty);
    }

    // Calculate sale prices (bi-directional)
    let sale = pricing.sale;
    let saleUnit = pricing.sale_unit;
    if (sale != null && saleUnit == null && qty > 0) {
      saleUnit = round2(sale / qty);
    } else if (saleUnit != null && sale == null) {
      sale = round2(saleUnit * qty);
    }

    // Build text_discount for pricing level
    // Combines list_discount_pct and sale_discount_pct: "-50%" or "-50% -10%"
    const pricingTextDiscount = buildTextDiscount(
      pricing.list_discount_pct,
      pricing.sale_discount_pct
    );

    // Enrich promotions with text_discount and recalculate promo_price
    // Each promotion gets pricing discounts + its own discount_percentage
    // Net price promotions (no discount_percentage, only promo_price) are skipped
    const enrichedPromotions = pkg.promotions?.map(promo => {
      // Skip for net price promotions (fixed promo_price, no percentage)
      if (!promo.discount_percentage) {
        return promo; // Keep promo as-is, mobile app shows promo_price directly
      }

      // Build text_discount: pricing discounts + promo discount
      // e.g., "-50% -20%" or "-50% -10% -20%"
      const promoTextDiscount = buildTextDiscount(
        pricing.list_discount_pct,
        pricing.sale_discount_pct,
        promo.discount_percentage
      );

      // Recalculate promo_price from the packaging's actual list_unit
      // The stored promo_price may have been computed from a different packaging
      const basePrice = listUnit ?? pricing.list_unit ?? pricing.list;
      let computedPromoPrice = promo.promo_price;
      if (basePrice != null) {
        computedPromoPrice = round2(basePrice * (1 - promo.discount_percentage / 100));
      }

      return {
        ...promo,
        promo_price: computedPromoPrice,
        text_discount: promoTextDiscount,
      };
    });

    return {
      ...pkg,
      pricing: {
        ...pricing,
        list,
        retail,
        sale,
        list_unit: listUnit,
        retail_unit: retailUnit,
        sale_unit: saleUnit,
        text_discount: pricingTextDiscount,
      },
      promotions: enrichedPromotions,
    };
  });
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
 * Extract technical specifications for the requested language
 * MongoDB stores: { it: [...], en: [...] } with arrays of specs
 */
function getLocalizedTechnicalSpecs(specs: any, lang: string): any[] | undefined {
  if (!specs) return undefined;

  // Check if it's language-keyed format: { it: [...], en: [...] }
  if (specs[lang] && Array.isArray(specs[lang])) {
    return specs[lang];
  }
  // Fallback to Italian, then English, then first available array
  if (specs.it && Array.isArray(specs.it)) {
    return specs.it;
  }
  if (specs.en && Array.isArray(specs.en)) {
    return specs.en;
  }

  // If it's already an array (flat format), return as-is
  if (Array.isArray(specs)) {
    return specs;
  }

  // Try to get first available language array
  const firstValue = Object.values(specs)[0];
  if (Array.isArray(firstValue)) {
    return firstValue;
  }

  return undefined;
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
      const mongoTechnicalSpecs = productData?.technical_specifications
        ? getLocalizedTechnicalSpecs(productData.technical_specifications, lang)
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
        // VAT rate: MongoDB (source of truth) → Solr → default 22%
        vat_rate: productData?.vat_rate ?? result.vat_rate ?? 22,
        // Replace Solr data with MongoDB data (source of truth, localized)
        attributes: mongoAttributes || result.attributes,
        technical_specifications: mongoTechnicalSpecs || result.technical_specifications,
        images: productData?.images || result.images,
        media: mongoMedia || result.media,
        packaging_options: enrichPackagingWithUnitPrices(
          embedPromotionsInPackaging(
            productData?.packaging_options || result.packaging_options,
            productData?.promotions
          )
        ),
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
          vat_rate: product.vat_rate ?? 22,
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
      const mongoTechnicalSpecs = productData.technical_specifications
        ? getLocalizedTechnicalSpecs(productData.technical_specifications, lang)
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
        vat_rate: productData.pricing?.vat_rate ?? product.vat_rate ?? 22,
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
        packaging_options: enrichPackagingWithUnitPrices(
          embedPromotionsInPackaging(
            productData.packaging_options || product.packaging_options,
            productData.promotions
          )
        ),
        // Media
        cover_image_url: productData.cover_image_url || product.cover_image_url,
        images: productData.images || product.images,
        media: mongoMedia || product.media,
        // Attributes & Technical Specifications
        attributes: mongoAttributes || product.attributes,
        technical_specifications: mongoTechnicalSpecs || product.technical_specifications,
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
