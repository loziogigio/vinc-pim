/**
 * eBay Marketplace Adapter
 * Integrates with eBay's Inventory API for product listing management
 * https://developer.ebay.com/api-docs/sell/inventory/overview.html
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { PIMProduct } from '../db/models/pim-product';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  TransformOptions,
  RateLimitInfo,
} from './types';

/**
 * eBay Inventory Item format
 */
interface EbayInventoryItem {
  sku: string;
  product: {
    title: string;
    description: string;
    aspects?: Record<string, string[]>;
    brand?: string;
    mpn?: string; // Manufacturer Part Number
    imageUrls?: string[];
  };
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_GOOD' | 'REFURBISHED';
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  packageWeightAndSize?: {
    dimensions?: {
      height?: number;
      length?: number;
      width?: number;
      unit?: 'INCH' | 'CENTIMETER';
    };
    weight?: {
      value?: number;
      unit?: 'POUND' | 'KILOGRAM';
    };
  };
}

/**
 * eBay Offer (pricing and listing details)
 */
interface EbayOffer {
  sku: string;
  marketplaceId: 'EBAY_IT' | 'EBAY_US' | 'EBAY_DE' | 'EBAY_FR' | 'EBAY_GB';
  format: 'FIXED_PRICE' | 'AUCTION';
  availableQuantity: number;
  categoryId: string;
  listingDescription: string;
  listingPolicies: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
  pricingSummary: {
    price: {
      value: string;
      currency: 'EUR' | 'USD' | 'GBP';
    };
  };
  merchantLocationKey?: string;
  tax?: {
    applyTax?: boolean;
    vatPercentage?: number;
  };
}

export class EbayAdapter extends MarketplaceAdapter {
  readonly name = 'eBay';
  readonly id = 'ebay';
  readonly requiresAuth = true;

  private baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(config: any) {
    super(config);
    this.baseUrl =
      config.environment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    await this.authenticate();
    this.log('Initialized');
  }

  async authenticate(): Promise<void> {
    try {
      // eBay uses OAuth 2.0
      // In production, you'd implement the full OAuth flow
      // For now, we assume the access token is provided in config

      if (this.config.access_token) {
        this.accessToken = this.config.access_token;
        this.log('Authenticated with provided access token');
        return;
      }

      // OAuth flow: exchange credentials for access token
      const tokenUrl = `${this.baseUrl}/identity/v1/oauth2/token`;
      const credentials = Buffer.from(
        `${this.config.app_id}:${this.config.api_secret}`
      ).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
        }),
      });

      if (!response.ok) {
        throw new Error(`eBay OAuth failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      this.log('Authenticated successfully');
    } catch (error: any) {
      this.logError('Authentication failed', error);
      throw error;
    }
  }

  async validateProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Required fields for eBay
    if (!product.title || product.title.length < 10) {
      errors.push({
        field: 'title',
        message: 'Title must be at least 10 characters',
        code: 'INVALID_TITLE',
      });
    }

    if (product.title && product.title.length > 80) {
      warnings.push({
        field: 'title',
        message: 'Title longer than 80 characters may be truncated',
        code: 'LONG_TITLE',
      });
    }

    if (!product.description) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        code: 'MISSING_DESCRIPTION',
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
        message: 'At least one image is required',
        code: 'MISSING_IMAGE',
      });
    }

    if (!product.category?.name) {
      errors.push({
        field: 'category',
        message: 'Category is required for eBay listing',
        code: 'MISSING_CATEGORY',
      });
    }

    if (!product.brand?.name) {
      warnings.push({
        field: 'brand',
        message: 'Brand improves listing quality',
        code: 'MISSING_BRAND',
      });
    }

    // Stock validation
    if (!product.stock_quantity || product.stock_quantity < 1) {
      warnings.push({
        field: 'stock_quantity',
        message: 'Product has no stock available',
        code: 'NO_STOCK',
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
  ): Promise<{ item: EbayInventoryItem; offer: EbayOffer }> {
    // Collect image URLs
    const imageUrls: string[] = [];
    if (product.image?.original) imageUrls.push(product.image.original);
    if (product.gallery && Array.isArray(product.gallery)) {
      product.gallery.forEach((img: any) => {
        if (img.url) imageUrls.push(img.url);
      });
    }

    // Build inventory item
    const item: EbayInventoryItem = {
      sku: product.sku || product.entity_code,
      product: {
        title: product.title?.substring(0, 80) || 'Untitled',
        description: product.description || '',
        brand: product.brand?.name,
        imageUrls: imageUrls.slice(0, 12), // eBay allows max 12 images
      },
      condition: 'NEW', // Default to NEW, override if product has condition field
      availability: {
        shipToLocationAvailability: {
          quantity: product.stock_quantity || 0,
        },
      },
    };

    // Add product aspects (attributes)
    if (product.attributes) {
      item.product.aspects = this.transformAttributes(product.attributes);
    }

    // Build offer
    const offer: EbayOffer = {
      sku: product.sku || product.entity_code,
      marketplaceId: 'EBAY_IT', // Default to Italy, should be configurable
      format: 'FIXED_PRICE',
      availableQuantity: product.stock_quantity || 0,
      categoryId: this.mapCategory(product.category?.name),
      listingDescription: product.description || '',
      listingPolicies: {
        fulfillmentPolicyId: this.config.custom_config?.fulfillment_policy_id,
        paymentPolicyId: this.config.custom_config?.payment_policy_id,
        returnPolicyId: this.config.custom_config?.return_policy_id,
      },
      pricingSummary: {
        price: {
          value: product.price?.toFixed(2) || '0.00',
          currency: (product.currency as any) || 'EUR',
        },
      },
    };

    return { item, offer };
  }

  async syncProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SyncResult> {
    try {
      this.log(`Syncing product: ${product.entity_code}`);

      // Validate
      const validation = await this.validateProduct(product, options);
      if (!validation.isValid) {
        return {
          success: false,
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Transform
      const { item, offer } = await this.transformProduct(product, options);

      // Step 1: Create/Update Inventory Item
      const itemResult = await this.createOrUpdateInventoryItem(item);
      if (!itemResult.success) {
        return itemResult;
      }

      // Step 2: Create/Update Offer
      const offerResult = await this.createOrUpdateOffer(offer);
      if (!offerResult.success) {
        return offerResult;
      }

      // Step 3: Publish Offer (make it live)
      const publishResult = await this.publishOffer(offer.sku);

      this.log(`✓ Product synced: ${product.entity_code}`);

      return publishResult;
    } catch (error: any) {
      this.logError('Failed to sync product', error);

      // Handle rate limiting
      if (error.status === 429 || error.message?.includes('rate limit')) {
        await this.handleRateLimit(error);
        throw error; // Re-throw for retry
      }

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
      // Withdraw (unpublish) the offer first
      const withdrawUrl = `${this.baseUrl}/sell/inventory/v1/offer/${productId}/withdraw`;
      await this.makeRequest(withdrawUrl, { method: 'POST' });

      // Then delete the offer
      const deleteOfferUrl = `${this.baseUrl}/sell/inventory/v1/offer/${productId}`;
      await this.makeRequest(deleteOfferUrl, { method: 'DELETE' });

      // Finally delete the inventory item
      const deleteItemUrl = `${this.baseUrl}/sell/inventory/v1/inventory_item/${productId}`;
      await this.makeRequest(deleteItemUrl, { method: 'DELETE' });

      return {
        success: true,
        status: 'active',
        message: 'Product deleted from eBay',
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
      const url = `${this.baseUrl}/sell/inventory/v1/inventory_item/${sku}`;

      await this.makeRequest(url, {
        method: 'PUT',
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity,
            },
          },
        }),
      });

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory updated on eBay',
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
      // Get the offer ID first
      const offersUrl = `${this.baseUrl}/sell/inventory/v1/offer?sku=${sku}`;
      const offersResponse = await this.makeRequest(offersUrl);
      const offers = await offersResponse.json();

      if (!offers.offers || offers.offers.length === 0) {
        throw new Error('No offer found for SKU');
      }

      const offerId = offers.offers[0].offerId;

      // Update the price
      const updateUrl = `${this.baseUrl}/sell/inventory/v1/offer/${offerId}/update_price`;
      await this.makeRequest(updateUrl, {
        method: 'POST',
        body: JSON.stringify({
          pricingSummary: {
            price: {
              value: price.toFixed(2),
              currency: 'EUR',
            },
          },
        }),
      });

      return {
        success: true,
        status: 'active',
        message: 'Price updated on eBay',
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
      const url = `${this.baseUrl}/sell/inventory/v1/inventory_item?limit=1`;
      const response = await this.makeRequest(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ========== PRIVATE HELPERS ==========

  private async createOrUpdateInventoryItem(
    item: EbayInventoryItem
  ): Promise<SyncResult> {
    try {
      const url = `${this.baseUrl}/sell/inventory/v1/inventory_item/${item.sku}`;
      const response = await this.makeRequest(url, {
        method: 'PUT',
        body: JSON.stringify(item),
      });

      return {
        success: response.ok,
        status: response.ok ? 'active' : 'error',
        message: response.ok ? 'Inventory item created/updated' : 'Failed to create inventory item',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  private async createOrUpdateOffer(offer: EbayOffer): Promise<SyncResult> {
    try {
      const url = `${this.baseUrl}/sell/inventory/v1/offer`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(offer),
      });

      const data = await response.json();

      return {
        success: response.ok,
        marketplace_id: data.offerId,
        status: response.ok ? 'pending' : 'error',
        message: response.ok ? 'Offer created' : 'Failed to create offer',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  private async publishOffer(sku: string): Promise<SyncResult> {
    try {
      // Get offer ID
      const offersUrl = `${this.baseUrl}/sell/inventory/v1/offer?sku=${sku}`;
      const offersResponse = await this.makeRequest(offersUrl);
      const offers = await offersResponse.json();

      if (!offers.offers || offers.offers.length === 0) {
        throw new Error('No offer found to publish');
      }

      const offerId = offers.offers[0].offerId;

      // Publish
      const publishUrl = `${this.baseUrl}/sell/inventory/v1/offer/${offerId}/publish`;
      const response = await this.makeRequest(publishUrl, { method: 'POST' });

      const data = await response.json();

      return {
        success: response.ok,
        marketplace_id: data.listingId,
        listing_url: data.listingUrl,
        status: 'active',
        message: 'Offer published on eBay',
        metadata: data,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: error.message,
      };
    }
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Ensure we have a valid token
    if (!this.accessToken) {
      await this.authenticate();
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    // Track rate limits
    this.updateRateLimitInfo(response);

    return response;
  }

  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: new Date(parseInt(reset) * 1000),
      };
    }
  }

  private transformAttributes(attributes: any, lang: string = 'it'): Record<string, string[]> {
    const aspects: Record<string, string[]> = {};

    // Helper to extract string from multilingual or simple value
    const extractString = (value: any, fallback: string = ''): string => {
      if (!value) return fallback;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'object') {
        // Try common languages in order
        return value.en || value.it || value.de || Object.values(value)[0] || fallback;
      }
      return fallback;
    };

    // Attributes are language-keyed: { it: { slug: {...} }, en: {...} }
    // Get the language-specific attributes, fallback to it, en, or first available
    const langAttributes = attributes[lang] || attributes.it || attributes.en ||
      (typeof attributes === 'object' ? Object.values(attributes)[0] : null);

    if (!langAttributes || typeof langAttributes !== 'object') {
      return aspects;
    }

    Object.entries(langAttributes).forEach(([slug, attrData]) => {
      // Handle new format: { label, value, uom }
      if (typeof attrData === 'object' && attrData !== null && 'value' in attrData) {
        // Extract label (multilingual or simple string)
        const labelStr = extractString(attrData.label, this.formatAspectName(slug));
        const aspectName = labelStr;

        // Extract value (multilingual or simple string/number)
        let aspectValue = extractString(attrData.value, '');

        // Append unit of measurement if available
        if (attrData.uom) {
          aspectValue = `${aspectValue} ${attrData.uom}`;
        }

        aspects[aspectName] = [aspectValue];
      }
      // Handle legacy format: simple value or array
      else {
        const aspectName = this.formatAspectName(slug);
        const aspectValue = Array.isArray(attrData) ? attrData : [String(attrData)];
        aspects[aspectName] = aspectValue;
      }
    });

    return aspects;
  }

  private formatAspectName(name: string): string {
    // Convert snake_case or camelCase to Title Case
    return name
      .replace(/[_-]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private mapCategory(categoryName?: string): string {
    // TODO: Implement proper category mapping
    // For now, return a default category
    // In production, maintain a mapping table: PIM category -> eBay category ID
    const categoryMapping: Record<string, string> = {
      'Electronics': '293',
      'Fashion': '11450',
      'Home & Garden': '11700',
      // Add more mappings
    };

    return categoryMapping[categoryName || ''] || '99'; // 99 = Everything Else
  }
}
