/**
 * Shared Brand Types
 * Used by both Brand model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (brand_id, label, slug)
 * - Self-contained: All fields including hierarchy (for brand families)
 */

/**
 * Brand hierarchy ancestor item
 * For brand families (e.g., Bosch → Bosch Professional)
 */
export interface BrandHierarchyItem {
  brand_id: string;
  label: string;
  slug: string;
  logo_url?: string;
  level: number;
}

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

  // Brand hierarchy (for brand families)
  parent_brand_id?: string;   // Optional: Parent brand ID
  brand_family?: string;      // Optional: Brand family name (e.g., "Bosch")
  level?: number;             // Optional: Brand hierarchy level (0 = parent, 1 = child)
  path?: string[];            // Optional: Ancestor brand IDs

  /**
   * SELF-CONTAINED: Full brand hierarchy
   * Critical for "filter by brand family" without database lookups
   *
   * Example:
   * hierarchy: [
   *   { brand_id: "bosch", label: "Bosch", slug: "bosch", level: 0 }
   * ]
   */
  hierarchy?: BrandHierarchyItem[];  // Optional: Include for self-contained mode
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
