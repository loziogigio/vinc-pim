/**
 * Shared Tag Types
 * Used by both Tag model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (tag_id, name, slug)
 * - Self-contained: All fields including tag group/category metadata
 */

import { MultilingualText } from "../pim";

/**
 * Tag group/category data
 * For grouped tag faceting (e.g., "Promotions", "Features", "SEO")
 */
export interface TagGroupData {
  group_id: string;
  group_name: MultilingualText;
  group_slug: string;
  group_type?: string;        // "promotion", "feature", "seo", "custom"
  display_order?: number;
}

// Base tag fields (for embedding in products)
export interface TagBase {
  tag_id: string;
  name: MultilingualText;
  slug: string;
  description?: string;       // Optional: Include for self-contained
  color?: string;             // Optional: Include for self-contained (hex color code)
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained

  // Tag categorization
  tag_category?: string;      // Optional: Category identifier (e.g., "promotion", "feature")
  tag_group?: string;         // Optional: Group identifier (e.g., "seasonal-offers")

  /**
   * SELF-CONTAINED: Full tag group data
   * Critical for grouped faceting without database lookups
   *
   * Example:
   * tag_group_data: {
   *   group_id: "promotions",
   *   group_name: { it: "Promozioni", en: "Promotions" },
   *   group_slug: "promotions",
   *   group_type: "promotion"
   * }
   */
  tag_group_data?: TagGroupData;  // Optional: Include for self-contained mode
}

// Tag embedded in products (supports both minimal and full)
export type TagEmbedded = TagBase;

// Full tag document (with metadata)
export interface TagDocument extends TagBase {
  description?: string;
  color?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}
