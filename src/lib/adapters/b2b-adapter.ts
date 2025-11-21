/**
 * B2B Storefront Adapter
 * Syncs PIM products to B2B storefront database/API
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
 * B2B Product format
 */
interface B2BProduct {
  entity_code: string;
  sku: string;
  name: Record<string, string>;
  description?: Record<string, string>;
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

  // B2B-specific fields
  wholesale_price?: number;
  min_order_quantity?: number;
  bulk_discounts?: any[];
  customer_group_pricing?: any;

  // Metadata
  created_at?: Date;
  updated_at?: Date;
  published_at?: Date;
}

export class B2BAdapter extends MarketplaceAdapter {
  readonly name = 'B2B Storefront';
  readonly id = 'b2b';
  readonly requiresAuth = false;

  private apiUrl: string;
  private apiKey?: string;

  constructor(config: any) {
    super(config);
    this.apiUrl = config.custom_config?.api_url || process.env.B2B_API_URL || 'http://localhost:3001';
    this.apiKey = config.api_key || process.env.B2B_API_KEY;
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initialized with API URL:', this.apiUrl);
  }

  async authenticate(): Promise<void> {
    // B2B API authentication if needed
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

    // Required fields for B2B
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
        message: 'Price is recommended for B2B products',
        code: 'MISSING_PRICE',
      });
    }

    // B2B-specific validations
    if (!product.quantity || product.quantity === 0) {
      warnings.push({
        field: 'quantity',
        message: 'Stock quantity should be set for B2B customers',
        code: 'MISSING_QUANTITY',
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
  ): Promise<B2BProduct> {
    const b2bProduct: B2BProduct = {
      entity_code: product.entity_code,
      sku: product.sku || product.entity_code,
      name: product.name || {},
      description: product.description || {},
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

      // B2B-specific fields
      wholesale_price: product.wholesale_price,
      min_order_quantity: product.min_order_quantity || 1,
      bulk_discounts: product.bulk_discounts,
      customer_group_pricing: product.customer_group_pricing,

      // Metadata
      created_at: product.created_at,
      updated_at: product.updated_at,
      published_at: product.published_at,
    };

    return b2bProduct;
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

      // Transform to B2B format
      const b2bProduct = await this.transformProduct(product, options);

      // Sync to B2B storefront API or database
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
        body: JSON.stringify(b2bProduct),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`B2B API error: ${response.status} - ${error}`);
      }

      const result = await response.json();

      this.log(`✓ Synced product ${product.entity_code} to B2B storefront`);

      return {
        success: true,
        marketplace_id: result.id || product.entity_code,
        listing_url: `${this.apiUrl}/products/${product.entity_code}`,
        status: 'active',
        message: 'Product synced to B2B storefront',
      };
    } catch (error: any) {
      this.logError('Failed to sync product to B2B storefront', error);
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
        throw new Error(`B2B API error: ${response.status}`);
      }

      this.log(`✓ Deleted product ${productId} from B2B storefront`);

      return {
        success: true,
        status: 'active',
        message: 'Product deleted from B2B storefront',
      };
    } catch (error: any) {
      this.logError('Failed to delete product from B2B storefront', error);
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
        throw new Error(`B2B API error: ${response.status}`);
      }

      this.log(`✓ Updated inventory for ${sku}: ${quantity} units`);

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory updated in B2B storefront',
      };
    } catch (error: any) {
      this.logError('Failed to update inventory in B2B storefront', error);
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
        throw new Error(`B2B API error: ${response.status}`);
      }

      this.log(`✓ Updated price for ${sku}: €${price}`);

      return {
        success: true,
        status: 'active',
        message: 'Price updated in B2B storefront',
      };
    } catch (error: any) {
      this.logError('Failed to update price in B2B storefront', error);
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
