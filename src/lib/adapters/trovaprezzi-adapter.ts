/**
 * Trovaprezzi Feed Adapter
 * Generates XML/CSV feeds for Trovaprezzi price comparison site
 * https://www.trovaprezzi.it/
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { PIMProduct } from '../db/models/pim-product';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  TransformOptions,
} from './types';

export class TrovaprezziAdapter extends MarketplaceAdapter {
  readonly name = 'Trovaprezzi';
  readonly id = 'trovaprezzi';
  readonly requiresAuth = false;

  private feedUrl?: string;

  constructor(config: any) {
    super(config);
    this.feedUrl = config.custom_config?.feed_url;
  }

  async initialize(): Promise<void> {
    this.log('Initialized (feed-based integration)');
  }

  async authenticate(): Promise<void> {
    // No authentication required for feed-based integration
  }

  async validateProduct(product: PIMProduct): Promise<ValidationResult> {
    const errors: any[] = [];

    if (!product.title) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        code: 'MISSING_TITLE',
      });
    }

    if (!product.price || product.price <= 0) {
      errors.push({
        field: 'price',
        message: 'Valid price is required',
        code: 'INVALID_PRICE',
      });
    }

    if (!product.image?.original) {
      errors.push({
        field: 'image',
        message: 'Image URL is required',
        code: 'MISSING_IMAGE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  async transformProduct(product: PIMProduct): Promise<any> {
    return {
      id: product.entity_code,
      name: product.title,
      description: product.description?.substring(0, 500),
      price: product.price?.toFixed(2),
      currency: product.currency || 'EUR',
      url: `https://yourstore.com/products/${product.entity_code}`,
      image_url: product.image?.original,
      category: product.category?.name,
      brand: product.brand?.name,
      availability: product.stock_quantity && product.stock_quantity > 0 ? 'in stock' : 'out of stock',
      ean: product.ean || '',
    };
  }

  async syncProduct(product: PIMProduct): Promise<SyncResult> {
    // Trovaprezzi uses XML feed that is generated periodically
    // This method adds the product to the feed queue
    this.log(`Product queued for feed: ${product.entity_code}`);

    return {
      success: true,
      status: 'pending',
      message: 'Product will be included in next feed generation',
    };
  }

  async deleteProduct(productId: string): Promise<SyncResult> {
    return {
      success: true,
      status: 'active',
      message: 'Product will be removed from next feed',
    };
  }

  async syncInventory(sku: string, quantity: number): Promise<InventorySyncResult> {
    return {
      success: true,
      sku,
      quantity,
      message: 'Availability will be updated in next feed',
    };
  }

  async syncPrice(sku: string, price: number): Promise<SyncResult> {
    return {
      success: true,
      status: 'pending',
      message: 'Price will be updated in next feed',
    };
  }

  async testConnection(): Promise<boolean> {
    return true; // Feed-based, always available
  }

  /**
   * Generate full XML feed for all products
   */
  async generateFeed(products: PIMProduct[]): Promise<string> {
    const items = await Promise.all(products.map((p) => this.transformProduct(p)));

    const xmlItems = items
      .map(
        (item) => `
    <product>
      <id>${this.escapeXml(item.id)}</id>
      <name>${this.escapeXml(item.name)}</name>
      <description>${this.escapeXml(item.description || '')}</description>
      <price>${item.price}</price>
      <currency>${item.currency}</currency>
      <url>${this.escapeXml(item.url)}</url>
      <image_url>${this.escapeXml(item.image_url)}</image_url>
      <category>${this.escapeXml(item.category || '')}</category>
      <brand>${this.escapeXml(item.brand || '')}</brand>
      <availability>${item.availability}</availability>
      <ean>${this.escapeXml(item.ean)}</ean>
    </product>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<products>
  ${xmlItems}
</products>`;
  }

  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
