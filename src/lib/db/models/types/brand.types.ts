/**
 * Shared Brand Types
 * Used by both Brand model and PIM Product model
 */

// Base brand fields (for embedding in products)
export interface BrandBase {
  brand_id: string;
  label: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active?: boolean;
}

// Brand embedded in products (denormalized snapshot)
export type BrandEmbedded = BrandBase;

// Full brand document (with metadata)
export interface BrandDocument extends BrandBase {
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}
