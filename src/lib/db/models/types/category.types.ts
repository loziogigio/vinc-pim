/**
 * Shared Category Types
 * Used by both Category model and PIM Product model
 */

import { MultilingualText } from "../pim-product";

// Base category fields (for embedding in products)
export interface CategoryBase {
  category_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  details?: MultilingualText;
  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
  icon?: string;
}

// Category embedded in products (denormalized snapshot)
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
