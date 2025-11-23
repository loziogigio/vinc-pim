/**
 * Shared Collection Types
 * Used by both Collection model and PIM Product model
 */

import { MultilingualText } from "../pim-product";

// Base collection fields (for embedding in products)
export interface CollectionBase {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
}

// Collection embedded in products (denormalized snapshot)
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
