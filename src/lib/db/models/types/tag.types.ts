/**
 * Shared Tag Types
 * Used by both Tag model and PIM Product model
 */

import { MultilingualText } from "../pim-product";

// Base tag fields (for embedding in products)
export interface TagBase {
  tag_id: string;
  name: MultilingualText;
  slug: string;
}

// Tag embedded in products (denormalized snapshot)
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
