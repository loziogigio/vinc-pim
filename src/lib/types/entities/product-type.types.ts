/**
 * Shared Product Type Types
 * Used by both ProductType model and PIM Product model
 *
 * Supports both minimal and self-contained (full) embedding:
 * - Minimal: Only required fields (product_type_id, name, slug)
 * - Self-contained: All fields including hierarchy, features, and inherited features
 */

import { MultilingualText } from "../pim";

// Product Type Feature
export interface ProductTypeFeature {
  key: string;
  label: MultilingualText;
  value?: string | number | boolean | string[];
  unit?: string;
}

/**
 * Product Type hierarchy ancestor item
 * For type hierarchies (e.g., Tools → Power Tools → Cordless Drills)
 */
export interface ProductTypeHierarchyItem {
  product_type_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  level: number;
  description?: string;
  features?: ProductTypeFeature[];  // Features at this hierarchy level
}

// Base product type fields (for embedding in products)
export interface ProductTypeBase {
  product_type_id: string;
  name: MultilingualText;
  slug: MultilingualText;
  features?: ProductTypeFeature[];  // Features defined at this type level
  description?: string;       // Optional: Include for self-contained
  is_active?: boolean;        // Optional: Include for self-contained
  product_count?: number;     // Optional: Include for self-contained
  display_order?: number;     // Optional: Include for self-contained

  // Product Type hierarchy
  parent_type_id?: string;    // Optional: Parent product type ID
  level?: number;             // Optional: Type hierarchy level (0 = root, 1 = child, etc.)
  path?: string[];            // Optional: Ancestor type IDs

  /**
   * SELF-CONTAINED: Full product type hierarchy
   * Critical for "filter by parent type" and feature inheritance
   *
   * Example:
   * hierarchy: [
   *   { product_type_id: "tools", name: { it: "Utensili" }, level: 0, features: [...] },
   *   { product_type_id: "power-tools", name: { it: "Elettroutensili" }, level: 1, features: [...] }
   * ]
   */
  hierarchy?: ProductTypeHierarchyItem[];  // Optional: Include for self-contained mode

  /**
   * INHERITED FEATURES: All features accumulated from parent types
   * Enables feature validation and display without hierarchy traversal
   *
   * Example: A "Hammer Drill" inherits features from "Cordless Drills" → "Power Tools" → "Tools"
   */
  inherited_features?: ProductTypeFeature[];  // Optional: Features from ancestors
}

// Product Type embedded in products (supports both minimal and full)
export type ProductTypeEmbedded = ProductTypeBase;

// Full product type document (with metadata)
export interface ProductTypeDocument extends ProductTypeBase {
  description?: string;
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: Date;
  updated_at: Date;
}
