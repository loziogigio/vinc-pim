/**
 * Shared Collection Types
 * Used by both Collection model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (collection_id, name, slug)
 * - Self-contained: All fields including hierarchy (for nested collections)
 */

import { MultilingualText } from "../pim-product";

/**
 * Collection hierarchy ancestor item
 * For nested collections (e.g., Seasonal → Summer 2024 → Beach Tools)
 */
export interface CollectionHierarchyItem {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
}

// Base collection fields (for embedding in products)
export interface CollectionBase {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  description?: string;       // Optional: Include for self-contained
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained

  // Collection hierarchy (for nested collections)
  parent_collection_id?: string;  // Optional: Parent collection ID
  level?: number;                 // Optional: Collection hierarchy level (0 = root, 1 = child, etc.)
  path?: string[];                // Optional: Ancestor collection IDs

  /**
   * SELF-CONTAINED: Full collection hierarchy
   * Critical for "filter by parent collection" without database lookups
   *
   * Example:
   * hierarchy: [
   *   { collection_id: "seasonal", name: { it: "Stagionale" }, level: 0 },
   *   { collection_id: "summer-2024", name: { it: "Estate 2024" }, level: 1 }
   * ]
   */
  hierarchy?: CollectionHierarchyItem[];  // Optional: Include for self-contained mode
}

// Collection embedded in products (supports both minimal and full)
export type CollectionEmbedded = CollectionBase;

// Full collection document (with metadata)
export interface CollectionDocument extends CollectionBase {
  description?: string;
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
