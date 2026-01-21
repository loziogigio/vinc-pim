/**
 * Correlation Types
 *
 * Type definitions for product correlations.
 */

import { CorrelationType, CorrelationSyncMode } from "@/lib/constants/correlation";
import { MultiLangString } from "./pim";

/**
 * Embedded target product data (self-contained for display)
 */
export interface CorrelationTargetProduct {
  entity_code: string;
  sku?: string;
  name: MultiLangString;
  cover_image_url?: string;
  price?: number;
}

/**
 * Product Correlation
 */
export interface ProductCorrelation {
  correlation_id: string;
  source_entity_code: string;
  target_entity_code: string;
  correlation_type: CorrelationType;

  // Self-contained target product data
  target_product: CorrelationTargetProduct;

  // Metadata
  position: number;
  is_bidirectional: boolean;
  is_active: boolean;

  // Tracking
  created_by?: string;
  source_import?: {
    source_id: string;
    source_name: string;
    imported_at: Date;
  };

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Create correlation request body
 */
export interface CreateCorrelationRequest {
  source_entity_code: string;
  target_entity_code: string;
  correlation_type?: CorrelationType;
  is_bidirectional?: boolean;
  position?: number;
}

/**
 * Correlation import source settings
 */
export interface CorrelationImportSettings {
  default_type: CorrelationType;
  create_bidirectional: boolean;
  sync_mode: CorrelationSyncMode;
}

/**
 * Correlation import row (from CSV)
 */
export interface CorrelationImportRow {
  source_entity_code: string;
  target_entity_code: string;
  is_bidirectional: boolean;
}

/**
 * Correlation stats for dashboard
 */
export interface CorrelationStats {
  total_correlations: number;
  products_with_correlations: number;
  by_type: Record<CorrelationType, number>;
  last_import?: {
    job_id: string;
    imported_at: Date;
    rows_processed: number;
    success_count: number;
    error_count: number;
  };
}
