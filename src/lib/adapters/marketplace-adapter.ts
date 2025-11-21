/**
 * Base Marketplace Adapter Interface
 * All marketplace adapters must implement this interface
 */

import { PIMProduct } from '../db/models/pim-product';
import {
  ValidationResult,
  SyncResult,
  InventorySyncResult,
  RateLimitInfo,
  MarketplaceConfig,
  TransformOptions,
  WebhookEvent,
} from './types';

/**
 * Base interface that all marketplace adapters must implement
 */
export abstract class MarketplaceAdapter {
  /**
   * Marketplace name (e.g., "eBay", "Amazon", "Solr")
   */
  abstract readonly name: string;

  /**
   * Marketplace identifier (e.g., "ebay", "amazon", "solr")
   */
  abstract readonly id: string;

  /**
   * Whether this adapter requires authentication
   */
  abstract readonly requiresAuth: boolean;

  /**
   * Configuration for this marketplace
   */
  protected config: MarketplaceConfig;

  /**
   * Rate limit tracking
   */
  protected rateLimitInfo?: RateLimitInfo;

  constructor(config: MarketplaceConfig) {
    this.config = config;
  }

  /**
   * Initialize the adapter (connect, authenticate, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Authenticate with the marketplace API
   */
  abstract authenticate(): Promise<void>;

  /**
   * Validate if a product can be synced to this marketplace
   */
  abstract validateProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<ValidationResult>;

  /**
   * Transform PIM product to marketplace-specific format
   */
  abstract transformProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<any>;

  /**
   * Sync a product to the marketplace (create or update)
   */
  abstract syncProduct(
    product: PIMProduct,
    options?: TransformOptions
  ): Promise<SyncResult>;

  /**
   * Delete a product from the marketplace
   */
  abstract deleteProduct(productId: string): Promise<SyncResult>;

  /**
   * Update inventory/stock for a product
   */
  abstract syncInventory(
    sku: string,
    quantity: number
  ): Promise<InventorySyncResult>;

  /**
   * Update price for a product
   */
  abstract syncPrice(sku: string, price: number): Promise<SyncResult>;

  /**
   * Handle rate limiting (wait and retry)
   */
  async handleRateLimit(error: any): Promise<void> {
    console.warn(`[${this.name}] Rate limit hit, waiting...`);

    // Extract retry-after from error if available
    const retryAfter = error.retryAfter || error.retry_after || 60;

    await this.sleep(retryAfter * 1000);
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.rateLimitInfo;
  }

  /**
   * Handle webhook events from the marketplace
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log(`[${this.name}] Received webhook:`, event.event_type);
    // Override in subclass to handle specific events
  }

  /**
   * Test connection to marketplace API
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get marketplace-specific health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      const connected = await this.testConnection();
      return {
        healthy: connected,
        message: connected ? 'Connected' : 'Connection failed',
        details: {
          rate_limit: this.rateLimitInfo,
          config: {
            enabled: this.config.enabled,
            environment: this.config.environment,
          },
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: error.message,
      };
    }
  }

  /**
   * Helper: Sleep for ms milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Check if config is valid
   */
  protected validateConfig(): void {
    if (!this.config.enabled) {
      throw new Error(`${this.name} adapter is disabled`);
    }

    if (this.requiresAuth && !this.config.access_token && !this.config.api_key) {
      throw new Error(`${this.name} adapter requires authentication credentials`);
    }
  }

  /**
   * Helper: Log with marketplace prefix
   */
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.name}]`, message, ...args);
  }

  /**
   * Helper: Log error with marketplace prefix
   */
  protected logError(message: string, error?: any): void {
    console.error(`[${this.name}]`, message, error);
  }
}
