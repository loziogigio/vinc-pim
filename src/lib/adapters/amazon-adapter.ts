/**
 * Amazon SP-API Adapter
 * Integrates with Amazon Selling Partner API
 * https://developer-docs.amazon.com/sp-api/
 */

import { MarketplaceAdapter } from './marketplace-adapter';
import { PIMProduct } from '../db/models/pim-product';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  TransformOptions,
} from './types';

export class AmazonAdapter extends MarketplaceAdapter {
  readonly name = 'Amazon SP-API';
  readonly id = 'amazon';
  readonly requiresAuth = true;

  private baseUrl: string;
  private marketplaceId: string;
  private accessToken?: string;

  constructor(config: any) {
    super(config);
    this.baseUrl =
      config.environment === 'production'
        ? 'https://sellingpartnerapi-eu.amazon.com'
        : 'https://sandbox.sellingpartnerapi-eu.amazon.com';
    this.marketplaceId = config.custom_config?.marketplace_id || 'A11IL2PNWYJU7H'; // Italy
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    await this.authenticate();
    this.log('Initialized');
  }

  async authenticate(): Promise<void> {
    try {
      // Amazon SP-API uses LWA (Login with Amazon) OAuth 2.0
      // Exchange refresh token for access token

      const tokenUrl = 'https://api.amazon.com/auth/o2/token';

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refresh_token || '',
          client_id: this.config.app_id || '',
          client_secret: this.config.api_secret || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Amazon OAuth failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

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
        message: 'SKU is required for Amazon',
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
        message: 'Description improves product conversion',
        code: 'MISSING_DESCRIPTION',
      });
    }

    if (!product.brand?.name) {
      errors.push({
        field: 'brand',
        message: 'Brand is required for most Amazon categories',
        code: 'MISSING_BRAND',
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
  ): Promise<any> {
    // Amazon Product Feed XML format
    return {
      sku: product.sku || product.entity_code,
      product_name: product.title,
      product_description: product.description,
      brand_name: product.brand?.name,
      manufacturer: product.brand?.name,
      item_type: product.category?.name,
      standard_price: product.price,
      currency: product.currency || 'EUR',
      quantity: product.stock_quantity || 0,
      main_image_url: product.image?.original,
      other_image_url1: product.images?.[0]?.original,
      other_image_url2: product.images?.[1]?.original,
      product_tax_code: 'A_GEN_NOTAX', // Default, should be configurable
    };
  }

  async syncProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SyncResult> {
    try {
      this.log(`Syncing product: ${product.entity_code}`);

      const validation = await this.validateProduct(product, options);
      if (!validation.isValid) {
        return {
          success: false,
          status: 'error',
          message: 'Validation failed',
          errors: validation.errors.map((e) => e.message),
        };
      }

      const productData = await this.transformProduct(product, options);

      // Amazon uses XML feeds for product updates
      const feedXml = this.generateProductFeedXml([productData]);

      // Submit feed
      const feedResult = await this.submitFeed('POST_PRODUCT_DATA', feedXml);

      // Note: Feed processing is asynchronous on Amazon
      // You need to poll the feed status later

      this.log(`✓ Product feed submitted: ${product.entity_code}`);

      return {
        success: true,
        marketplace_id: feedResult.feedId,
        status: 'pending',
        message: 'Product feed submitted, processing asynchronously',
        metadata: feedResult,
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
      const deleteXml = this.generateDeleteFeedXml([productId]);
      const feedResult = await this.submitFeed('POST_PRODUCT_DATA', deleteXml);

      return {
        success: true,
        status: 'pending',
        message: 'Delete feed submitted',
        metadata: feedResult,
      };
    } catch (error: any) {
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
      const inventoryXml = this.generateInventoryFeedXml([{ sku, quantity }]);
      await this.submitFeed('POST_INVENTORY_AVAILABILITY_DATA', inventoryXml);

      return {
        success: true,
        sku,
        quantity,
        message: 'Inventory feed submitted',
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
      const priceXml = this.generatePriceFeedXml([{ sku, price, currency: 'EUR' }]);
      await this.submitFeed('POST_PRODUCT_PRICING_DATA', priceXml);

      return {
        success: true,
        status: 'pending',
        message: 'Price feed submitted',
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
      const url = `${this.baseUrl}/feeds/2021-06-30/feeds?limit=1`;
      const response = await this.makeRequest(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ========== PRIVATE HELPERS ==========

  private async submitFeed(feedType: string, feedContent: string): Promise<any> {
    // Step 1: Create feed document
    const createDocUrl = `${this.baseUrl}/feeds/2021-06-30/documents`;
    const docResponse = await this.makeRequest(createDocUrl, {
      method: 'POST',
      body: JSON.stringify({ contentType: 'text/xml; charset=UTF-8' }),
    });

    const docData = await docResponse.json();
    const uploadUrl = docData.url;
    const feedDocumentId = docData.feedDocumentId;

    // Step 2: Upload feed content
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
      body: feedContent,
    });

    // Step 3: Create feed
    const createFeedUrl = `${this.baseUrl}/feeds/2021-06-30/feeds`;
    const feedResponse = await this.makeRequest(createFeedUrl, {
      method: 'POST',
      body: JSON.stringify({
        feedType,
        marketplaceIds: [this.marketplaceId],
        inputFeedDocumentId: feedDocumentId,
      }),
    });

    return await feedResponse.json();
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    return await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': this.accessToken!,
        ...options.headers,
      },
    });
  }

  private generateProductFeedXml(products: any[]): string {
    const items = products
      .map(
        (p) => `
      <Message>
        <MessageID>${Math.random()}</MessageID>
        <OperationType>Update</OperationType>
        <Product>
          <SKU>${p.sku}</SKU>
          <StandardProductID>
            <Type>EAN</Type>
            <Value>${p.ean || ''}</Value>
          </StandardProductID>
          <ProductTaxCode>${p.product_tax_code}</ProductTaxCode>
          <DescriptionData>
            <Title>${this.escapeXml(p.product_name)}</Title>
            <Brand>${this.escapeXml(p.brand_name)}</Brand>
            <Description>${this.escapeXml(p.product_description)}</Description>
          </DescriptionData>
          <ProductData>
            <ItemType>${p.item_type}</ItemType>
          </ProductData>
        </Product>
      </Message>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.config.custom_config?.merchant_id || ''}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>
  ${items}
</AmazonEnvelope>`;
  }

  private generateInventoryFeedXml(items: { sku: string; quantity: number }[]): string {
    const messages = items
      .map(
        (item, idx) => `
      <Message>
        <MessageID>${idx + 1}</MessageID>
        <OperationType>Update</OperationType>
        <Inventory>
          <SKU>${item.sku}</SKU>
          <Quantity>${item.quantity}</Quantity>
        </Inventory>
      </Message>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.config.custom_config?.merchant_id || ''}</MerchantIdentifier>
  </Header>
  <MessageType>Inventory</MessageType>
  ${messages}
</AmazonEnvelope>`;
  }

  private generatePriceFeedXml(
    items: { sku: string; price: number; currency: string }[]
  ): string {
    const messages = items
      .map(
        (item, idx) => `
      <Message>
        <MessageID>${idx + 1}</MessageID>
        <OperationType>Update</OperationType>
        <Price>
          <SKU>${item.sku}</SKU>
          <StandardPrice currency="${item.currency}">${item.price.toFixed(2)}</StandardPrice>
        </Price>
      </Message>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.config.custom_config?.merchant_id || ''}</MerchantIdentifier>
  </Header>
  <MessageType>Price</MessageType>
  ${messages}
</AmazonEnvelope>`;
  }

  private generateDeleteFeedXml(skus: string[]): string {
    const messages = skus
      .map(
        (sku, idx) => `
      <Message>
        <MessageID>${idx + 1}</MessageID>
        <OperationType>Delete</OperationType>
        <Product>
          <SKU>${sku}</SKU>
        </Product>
      </Message>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.config.custom_config?.merchant_id || ''}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>
  ${messages}
</AmazonEnvelope>`;
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
