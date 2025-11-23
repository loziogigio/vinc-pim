/**
 * Shared Collection Types
 * Used by both Collection model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (collection_id, name, slug)
 * - Self-contained: All fields including metadata
 */

import { MultilingualText } from "../pim-product";

// Base collection fields (for embedding in products)
export interface CollectionBase {
  collection_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  description?: string;       // Optional: Include for self-contained
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained
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
