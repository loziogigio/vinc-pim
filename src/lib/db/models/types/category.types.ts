/**
 * Shared Category Types
 * Used by both Category model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (category_id, name, slug)
 * - Self-contained: All fields including hierarchy (parent_id, level, path)
 */

import { MultilingualText } from "../pim-product";

// Base category fields (for embedding in products)
export interface CategoryBase {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  details?: MultilingualText;
  description?: string;       // Optional: Include for self-contained
  parent_id?: string;         // Optional: Include for hierarchy
  level?: number;             // Optional: Include for hierarchy
  path?: string[];            // Optional: Include for hierarchy (e.g., ["tools", "power-tools", "drills"])
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
