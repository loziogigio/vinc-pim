/**
 * Shared Product Type Types
 * Used by both ProductType model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (product_type_id, name, slug)
 * - Self-contained: All fields including features and metadata
 */

import { MultilingualText } from "../pim-product";

// Product Type Feature
export interface ProductTypeFeature {
  key: string;
  label: MultilingualText;
  value: string | number | boolean | string[];
  unit?: string;
}

// Base product type fields (for embedding in products)
export interface ProductTypeBase {
  product_type_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  features?: ProductTypeFeature[];
  description?: string;       // Optional: Include for self-contained
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained
}

// Product Type embedded in products (supports both minimal and full)
export type ProductTypeEmbedded = ProductTypeBase;

// Full product type document (with metadata)
export interface ProductTypeDocument extends ProductTypeBase {
  description?: string;
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: Date;
  updated_at: Date;
}
