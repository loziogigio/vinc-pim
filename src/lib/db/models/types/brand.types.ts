/**
 * Shared Brand Types
 * Used by both Brand model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (brand_id, label, slug)
 * - Self-contained: All fields including metadata
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
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained
}

// Brand embedded in products (supports both minimal and full)
export type BrandEmbedded = BrandBase;

// Full brand document (with metadata)
export interface BrandDocument extends BrandBase {
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}
