/**
 * Solr 9 Search Adapter - Multilingual Support
 * Indexes PIM products into Solr with language-specific fields
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { PIMProduct } from '../db/models/pim-product';
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
  isCurrent?: boolean;
  isCurrentPublished?: boolean;
  status: string;
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

  // Relationships (language-independent IDs)
  category_id?: string;
  brand_id?: string;
  product_type_id?: string;
  collection_ids?: string[];

  // Promotions
  promo_codes?: string[];
  has_active_promo?: boolean;

  // Media
  has_video?: boolean;
  image_count?: number;
  cover_image_url?: string;

  // Variations
  is_parent?: boolean;
  parent_sku?: string;
  parent_entity_code?: string;

  // Complex objects stored as JSON (for frontend display)
  specifications_json?: string;
  attributes_json?: string;
  media_json?: string;
  packaging_json?: string;
  promotions_json?: string;
  product_type_features_json?: string;

  // Relationship objects with multilingual content (stored as JSON)
  category_json?: string;
  brand_json?: string;
  collections_json?: string;
  product_type_json?: string;

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
    this.solrUrl = config.custom_config?.solr_url || 'http://localhost:8983/solr';
    this.solrCore = config.custom_config?.solr_core || 'mycore';
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
   * Transform PIM product to Solr multilingual document
   * Converts MongoDB multilingual structure to Solr language-specific fields
   */
  async transformProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SolrMultilingualDocument> {
    const lang = options?.language; // Optional: index only specific language

    // Base document with language-independent fields
    const doc: SolrMultilingualDocument = {
      id: product.entity_code,
      sku: product.sku || product.entity_code,
      entity_code: product.entity_code,
      ean: product.ean,

      // Versioning
      version: product.version,
      isCurrent: product.isCurrent,
      isCurrentPublished: product.isCurrentPublished,
      status: product.status,
      product_status: product.product_status,

      // Dates
      created_at: product.created_at?.toISOString(),
      updated_at: product.updated_at?.toISOString(),
      published_at: product.published_at?.toISOString(),

      // Inventory
      quantity: product.quantity,
      sold: product.sold,
      unit: product.unit,
      stock_status: product.stock_status,

      // Quality
      completeness_score: product.completeness_score,

      // Analytics
      views_30d: product.analytics?.views_30d,
      clicks_30d: product.analytics?.clicks_30d,
      add_to_cart_30d: product.analytics?.add_to_cart_30d,
      conversions_30d: product.analytics?.conversions_30d,
      priority_score: product.analytics?.priority_score,

      // Relationships (IDs)
      category_id: product.category?.id,
      brand_id: product.brand?.id,
      product_type_id: product.product_type?.id,
      collection_ids: product.collections?.map(c => c.id),

      // Promotions
      promo_codes: product.promotions?.filter(p => p.is_active).map(p => p.promo_code).filter(Boolean) as string[],
      has_active_promo: product.promotions?.some(p => p.is_active) || false,

      // Media
      has_video: product.media?.some(m => m.type === 'video'),
      image_count: product.gallery?.length || 0,
      cover_image_url: product.gallery?.[0]?.url,

      // Variations
      is_parent: !!product.variations && product.variations.length > 0,
      parent_sku: product.parent_sku,
      parent_entity_code: product.parent_entity_code,

      // Complex objects stored as JSON (for frontend display, not faceting)
      specifications_json: product.specifications ? JSON.stringify(product.specifications) : undefined,
      attributes_json: product.attributes ? JSON.stringify(product.attributes) : undefined,
      media_json: product.media ? JSON.stringify(product.media) : undefined,
      packaging_json: product.packaging_options ? JSON.stringify(product.packaging_options) : undefined,
      promotions_json: product.promotions ? JSON.stringify(product.promotions) : undefined,
      product_type_features_json: product.product_type_features ? JSON.stringify(product.product_type_features) : undefined,

      // Relationship objects with multilingual content (stored as JSON)
      category_json: product.category ? JSON.stringify(product.category) : undefined,
      brand_json: product.brand ? JSON.stringify(product.brand) : undefined,
      collections_json: product.collections ? JSON.stringify(product.collections) : undefined,
      product_type_json: product.product_type ? JSON.stringify(product.product_type) : undefined,
    };

    // Add multilingual fields for each language
    const languages = lang ? [lang] : this.detectLanguages(product);

    for (const l of languages) {
      // Core product fields
      if (product.name?.[l]) {
        doc[`name_text_${l}`] = product.name[l];
      }
      if (product.slug?.[l]) {
        doc[`slug_text_${l}`] = product.slug[l];
      }
      if (product.description?.[l]) {
        doc[`description_text_${l}`] = product.description[l];
      }
      if (product.short_description?.[l]) {
        doc[`short_description_text_${l}`] = product.short_description[l];
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
        let specs = product.specifications[l];
        if (typeof specs === 'string') {
          try {
            specs = JSON.parse(specs);
          } catch (e) {
            // If parsing fails, skip this field
            specs = null;
          }
        }

        if (Array.isArray(specs)) {
          const specLabels = specs.map(spec => spec.label).filter(Boolean);
          if (specLabels.length > 0) {
            doc[`spec_labels_text_${l}`] = specLabels;
          }
        }
      }

      // Attribute labels (extract from nested array)
      if (product.attributes?.[l]) {
        // Handle both array format and JSON string format
        let attrs = product.attributes[l];
        if (typeof attrs === 'string') {
          try {
            attrs = JSON.parse(attrs);
          } catch (e) {
            // If parsing fails, skip this field
            attrs = null;
          }
        }

        if (Array.isArray(attrs)) {
          const attrLabels = attrs.map(attr => attr.label).filter(Boolean);
          if (attrLabels.length > 0) {
            doc[`attr_labels_text_${l}`] = attrLabels;
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

      // Collection names and slugs
      if (product.collections) {
        const collectionNames = product.collections
          .map(c => c.name?.[l])
          .filter(Boolean) as string[];
        if (collectionNames.length > 0) {
          doc[`collection_names_text_${l}`] = collectionNames;
        }

        const collectionSlugs = product.collections
          .map(c => c.slug?.[l])
          .filter(Boolean) as string[];
        if (collectionSlugs.length > 0) {
          doc[`collection_slugs_text_${l}`] = collectionSlugs;
        }
      }

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

    // Check attributes
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
        throw new Error(`Bulk index failed: ${response.status}`);
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
