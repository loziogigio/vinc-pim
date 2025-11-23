/**
 * Shared Product Type Types
 * Used by both ProductType model and PIM Product model
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
}

// Product Type embedded in products (denormalized snapshot)
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
