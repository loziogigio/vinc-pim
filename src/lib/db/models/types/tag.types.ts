/**
 * Shared Tag Types
 * Used by both Tag model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (tag_id, name, slug)
 * - Self-contained: All fields including metadata
 */

import { MultilingualText } from "../pim-product";

// Base tag fields (for embedding in products)
export interface TagBase {
  tag_id: string;
  name: MultilingualText;
  slug: string;
  description?: string;       // Optional: Include for self-contained
  color?: string;             // Optional: Include for self-contained
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained
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
