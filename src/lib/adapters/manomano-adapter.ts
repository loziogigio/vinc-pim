/**
 * ManoMano Marketplace Adapter
 * Integrates with ManoMano API for DIY/Home improvement products
 * https://developers.manomano.com/
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { PIMProduct } from '../db/models/pim-product';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  TransformOptions,
} from './types';

export class ManoManoAdapter extends MarketplaceAdapter {
  readonly name = 'ManoMano';
  readonly id = 'manomano';
  readonly requiresAuth = true;

  private baseUrl = 'https://api.manomano.com/v1';
  private accessToken?: string;

  constructor(config: any) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    await this.authenticate();
    this.log('Initialized');
  }

  async authenticate(): Promise<void> {
    try {
      // ManoMano uses API key authentication
      this.accessToken = this.config.api_key;
      this.log('Authenticated with API key');
    } catch (error: any) {
      this.logError('Authentication failed', error);
      throw error;
    }
  }

  async validateProduct(product: PIMProduct): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!product.title) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        code: 'MISSING_TITLE',
      });
    }

    if (!product.sku) {
      errors.push({
        field: 'sku',
        message: 'SKU is required',
        code: 'MISSING_SKU',
      });
    }

    if (!product.price || product.price <= 0) {
      errors.push({
        field: 'price',
        message: 'Valid price is required',
        code: 'INVALID_PRICE',
      });
    }

    if (!product.description) {
      warnings.push({
        field: 'description',
        message: 'Description improves conversion',
        code: 'MISSING_DESCRIPTION',
      });
    }

    if (!product.image?.original) {
      errors.push({
        field: 'image',
        message: 'At least one image is required',
        code: 'MISSING_IMAGE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformProduct(product: PIMProduct): Promise<any> {
    return {
      sku: product.sku || product.entity_code,
      title: product.title,
      description: product.description,
      brand: product.brand?.name,
      price: product.price,
      currency: product.currency || 'EUR',
      stock: product.stock_quantity || 0,
      images: [
        product.image?.original,
        ...(product.gallery?.map((img: any) => img.url) || []),
      ].filter(Boolean),
      category: product.category?.name,
      attributes: product.attributes || {},
    };
  }

  async syncProduct(product: PIMProduct): Promise<SyncResult> {
    try {
      this.log(`Syncing product: ${product.entity_code}`);

      const validation = await this.validateProduct(product);
      if (!validation.isValid) {
        return {
          success: false,
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors.map((e) => e.message),
        };
      }

      const productData = await this.transformProduct(product);

      // Create or update product on ManoMano
      const url = `${this.baseUrl}/products`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      this.log(`✓ Product synced: ${product.entity_code}`);

      return {
        success: response.ok,
        marketplace_id: data.id,
        status: response.ok ? 'active' : 'error',
        message: response.ok ? 'Product created/updated on ManoMano' : 'Failed to sync',
        metadata: data,
      };
    } catch (error: any) {
      this.logError('Failed to sync product', error);
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  async deleteProduct(productId: string): Promise<SyncResult> {
    try {
      const url = `${this.baseUrl}/products/${productId}`;
      await this.makeRequest(url, { method: 'DELETE' });

      return {
        success: true,
        status: 'active',
        message: 'Product deleted from ManoMano',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  async syncInventory(sku: string, quantity: number): Promise<InventorySyncResult> {
    try {
      const url = `${this.baseUrl}/products/${sku}/stock`;
      await this.makeRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ stock: quantity }),
      });

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory updated on ManoMano',
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
      const url = `${this.baseUrl}/products/${sku}/price`;
      await this.makeRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ price, currency: 'EUR' }),
      });

      return {
        success: true,
        status: 'active',
        message: 'Price updated on ManoMano',
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
      const url = `${this.baseUrl}/products?limit=1`;
      const response = await this.makeRequest(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    return await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.accessToken || '',
        ...options.headers,
      },
    });
  }
}
