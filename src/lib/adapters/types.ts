/**
 * Marketplace Adapter Types
 * Common types for all marketplace integrations
 */

import { PIMProduct } from '../db/models/pim-product';

/**
 * Validation result for product compatibility with marketplace
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Sync result after attempting to sync a product
 */
export interface SyncResult {
  success: boolean;
  marketplace_id?: string; // ID assigned by the marketplace
  listing_url?: string; // URL to view the listing
  status: 'active' | 'pending' | 'rejected' | 'error';
  message?: string;
  errors?: string[];
  metadata?: Record<string, any>;
}

/**
 * Inventory sync result
 */
export interface InventorySyncResult {
  success: boolean;
  sku: string;
  quantity: number;
  message?: string;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number; // Max requests per window
  remaining: number; // Remaining requests
  reset: Date; // When the window resets
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  enabled: boolean;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  app_id?: string;
  environment?: 'production' | 'sandbox';
  rate_limit?: {
    max_requests: number;
    window_seconds: number;
  };
  custom_config?: Record<string, any>;
}

/**
 * Product transformation options
 */
export interface TransformOptions {
  include_variants?: boolean;
  image_format?: 'url' | 'base64';
  price_currency?: string;
  category_mapping?: Record<string, string>;
  attribute_mapping?: Record<string, string>;
  language?: string; // Language code for multilingual indexing
}

/**
 * Sync operation type
 */
export type SyncOperation = 'create' | 'update' | 'delete' | 'inventory' | 'price' | 'bulk-sync' | 'bulk-index-language';

/**
 * Sync job data
 */
export interface SyncJobData {
  product_id: string;
  tenant_id: string;
  operation: SyncOperation;
  channels: string[]; // Which marketplaces to sync to
  options?: TransformOptions;
  priority?: 'low' | 'normal' | 'high';

  // Bulk sync fields
  product_ids?: string[];  // Array of product IDs for bulk operations

  // Bulk language indexing fields
  language?: string;       // Language code for bulk indexing
  productCount?: number;   // Estimated product count for bulk operations
}

/**
 * Webhook event from marketplace
 */
export interface WebhookEvent {
  marketplace: string;
  event_type: string;
  event_id: string;
  timestamp: Date;
  data: Record<string, any>;
}
