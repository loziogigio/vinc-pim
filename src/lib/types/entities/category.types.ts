/**
 * Shared Category Types
 * Used by both Category model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (category_id, name, slug)
 * - Self-contained: All fields including hierarchy with full ancestor data
 */

import { MultilingualText } from "../pim";

/**
 * Category hierarchy ancestor item
 * Contains full data for each ancestor in the category tree
 */
export interface CategoryHierarchyItem {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;
}

// Base category fields (for embedding in products)
export interface CategoryBase {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  details?: MultilingualText;
  description?: string;       // Optional: Include for self-contained
  parent_id?: string;         // Optional: Include for hierarchy reference
  level?: number;             // Optional: Category depth (0 = root, 1 = child, etc.)
  path?: string[];            // Optional: Ancestor IDs (e.g., ["1245", "1244"])

  /**
   * SELF-CONTAINED: Full hierarchy with ancestor data
   * Critical for faceting and breadcrumbs without database lookups
   *
   * Example:
   * hierarchy: [
   *   { category_id: "1245", name: { it: "Utensili" }, slug: { it: "utensili" }, level: 0 },
   *   { category_id: "1244", name: { it: "Elettroutensili" }, slug: { it: "elettroutensili" }, level: 1 }
   * ]
   */
  hierarchy?: CategoryHierarchyItem[];  // Optional: Include for self-contained mode

  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained
}

// Category embedded in products (supports both minimal and full with hierarchy)
export type CategoryEmbedded = CategoryBase;

// Full category document (with metadata and hierarchy)
export interface CategoryDocument extends Omit<CategoryBase, 'category_id'> {
  category_id: string;
  description?: string;
  parent_id?: string;
  level: number;
  path: string[];
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: Date;
  updated_at: Date;
}
