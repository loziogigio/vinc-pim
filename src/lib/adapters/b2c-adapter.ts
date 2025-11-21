/**
 * B2C Storefront Adapter
 * Syncs PIM products to B2C storefront database/API
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
 * B2C Product format
 */
interface B2CProduct {
  entity_code: string;
  sku: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  short_description?: Record<string, string>;
  price?: number;
  currency?: string;
  quantity?: number;
  status: string;
  brand?: any;
  category?: any;
  collections?: any[];
  product_type?: any;
  media?: any[];
  specifications?: any;
  attributes?: any;
  ean?: string[];

  // B2C-specific fields
  retail_price?: number;
  sale_price?: number;
  discount_percentage?: number;
  featured?: boolean;
  bestseller?: boolean;
  new_arrival?: boolean;

  // SEO
  meta_title?: Record<string, string>;
  meta_description?: Record<string, string>;
  slug?: Record<string, string>;

  // Reviews & ratings
  rating?: number;
  review_count?: number;

  // Metadata
  created_at?: Date;
  updated_at?: Date;
  published_at?: Date;
}

export class B2CAdapter extends MarketplaceAdapter {
  readonly name = 'B2C Storefront';
  readonly id = 'b2c';
  readonly requiresAuth = false;

  private apiUrl: string;
  private apiKey?: string;

  constructor(config: any) {
    super(config);
    this.apiUrl = config.custom_config?.api_url || process.env.B2C_API_URL || 'http://localhost:3002';
    this.apiKey = config.api_key || process.env.B2C_API_KEY;
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initialized with API URL:', this.apiUrl);
  }

  async authenticate(): Promise<void> {
    // B2C API authentication if needed
    if (this.apiKey) {
      this.log('API key configured');
    } else {
      this.log('No authentication configured');
    }
  }

  async validateProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Required fields for B2C
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
        message: 'Name is required',
        code: 'MISSING_NAME',
      });
    }

    if (!product.price) {
      warnings.push({
        field: 'price',
        message: 'Price is required for B2C products',
        code: 'MISSING_PRICE',
      });
    }

    // B2C-specific validations
    if (!product.description || Object.keys(product.description).length === 0) {
      warnings.push({
        field: 'description',
        message: 'Description is important for customer experience',
        code: 'MISSING_DESCRIPTION',
      });
    }

    if (!product.media || product.media.length === 0) {
      warnings.push({
        field: 'media',
        message: 'Product images are essential for B2C sales',
        code: 'MISSING_MEDIA',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<B2CProduct> {
    const b2cProduct: B2CProduct = {
      entity_code: product.entity_code,
      sku: product.sku || product.entity_code,
      name: product.name || {},
      description: product.description || {},
      short_description: product.short_description || {},
      price: product.price,
      currency: product.currency || 'EUR',
      quantity: product.quantity,
      status: product.status,
      brand: product.brand,
      category: product.category,
      collections: product.collections,
      product_type: product.product_type,
      media: product.media,
      specifications: product.specifications,
      attributes: product.attributes,
      ean: product.ean,

      // B2C-specific fields
      retail_price: product.retail_price || product.price,
      sale_price: product.sale_price,
      discount_percentage: product.discount_percentage,
      featured: product.featured || false,
      bestseller: product.bestseller || false,
      new_arrival: product.new_arrival || false,

      // SEO fields
      meta_title: product.meta_title || product.name,
      meta_description: product.meta_description || product.description,
      slug: product.slug,

      // Reviews
      rating: product.rating || 0,
      review_count: product.review_count || 0,

      // Metadata
      created_at: product.created_at,
      updated_at: product.updated_at,
      published_at: product.published_at,
    };

    return b2cProduct;
  }

  async syncProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SyncResult> {
    try {
      // Validate product
      const validation = await this.validateProduct(product, options);
      if (!validation.isValid) {
        return {
          success: false,
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Transform to B2C format
      const b2cProduct = await this.transformProduct(product, options);

      // Sync to B2C storefront API or database
      const endpoint = `${this.apiUrl}/api/products/${product.entity_code}`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify(b2cProduct),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`B2C API error: ${response.status} - ${error}`);
      }

      const result = await response.json();

      this.log(`✓ Synced product ${product.entity_code} to B2C storefront`);

      return {
        success: true,
        marketplace_id: result.id || product.entity_code,
        listing_url: `${this.apiUrl}/products/${product.entity_code}`,
        status: 'active',
        message: 'Product synced to B2C storefront',
      };
    } catch (error: any) {
      this.logError('Failed to sync product to B2C storefront', error);
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
      const endpoint = `${this.apiUrl}/api/products/${productId}`;
      const headers: any = {};

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`B2C API error: ${response.status}`);
      }

      this.log(`✓ Deleted product ${productId} from B2C storefront`);

      return {
        success: true,
        status: 'active',
        message: 'Product deleted from B2C storefront',
      };
    } catch (error: any) {
      this.logError('Failed to delete product from B2C storefront', error);
      return {
        success: false,
        status: 'error',
        message: error.message,
        errors: [error.message],
      };
    }
  }

  async syncInventory(
    sku: string,
    quantity: number
  ): Promise<InventorySyncResult> {
    try {
      const endpoint = `${this.apiUrl}/api/products/${sku}/inventory`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        throw new Error(`B2C API error: ${response.status}`);
      }

      this.log(`✓ Updated inventory for ${sku}: ${quantity} units`);

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory updated in B2C storefront',
      };
    } catch (error: any) {
      this.logError('Failed to update inventory in B2C storefront', error);
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
      const endpoint = `${this.apiUrl}/api/products/${sku}/price`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ price }),
      });

      if (!response.ok) {
        throw new Error(`B2C API error: ${response.status}`);
      }

      this.log(`✓ Updated price for ${sku}: €${price}`);

      return {
        success: true,
        status: 'active',
        message: 'Price updated in B2C storefront',
      };
    } catch (error: any) {
      this.logError('Failed to update price in B2C storefront', error);
      return {
        success: false,
        status: 'error',
        message: error.message,
        errors: [error.message],
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const endpoint = `${this.apiUrl}/api/health`;
      const headers: any = {};

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
