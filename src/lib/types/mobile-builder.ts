/**
 * Mobile Builder Types
 *
 * Types for the Mobile Home Builder application.
 * Focused on mobile app/PWA layout with touch-optimized components.
 */

import type { MultiLangString } from "./pim";

// ============================================================================
// App Identity (Header)
// ============================================================================

export interface MobileAppIdentity {
  app_name: string;
  logo_url: string;
  logo_width: number;   // px
  logo_height?: number; // px, optional (maintain aspect ratio)
}

export const DEFAULT_APP_IDENTITY: MobileAppIdentity = {
  app_name: "",
  logo_url: "",
  logo_width: 64,
};

// ============================================================================
// Block Types
// ============================================================================

export const MOBILE_BLOCK_TYPES = [
  "mobile_media_slider",
  "mobile_product_slider",
  "mobile_media_gallery",
  "mobile_product_gallery",
] as const;

export type MobileBlockType = (typeof MOBILE_BLOCK_TYPES)[number];

// ============================================================================
// Common Types
// ============================================================================

export type AspectRatio = "16:9" | "4:3" | "1:1" | "9:16";
export type GapSize = "none" | "sm" | "md";
export type ColumnCount = 2 | 3;

/** Block visibility - who can see this block */
export type BlockVisibility = "all" | "logged_in_only";

/** Common settings for all blocks */
export interface BlockCommonSettings {
  /** Who can see this block */
  visibility: BlockVisibility;
}

export interface MediaItem {
  media_url: string;
  media_type: "image" | "video";
  link_url?: string;
  alt_text?: string;
  title?: string;
}

export type ProductSource = "manual" | "collection" | "category" | "tag" | "search";

/** Cached product data for preview */
export interface CachedProduct {
  entity_code: string;
  sku: string;
  name: string;
  cover_image_url?: string;
  price?: number;
  stock_status?: string;
}

// ============================================================================
// Media Slider Block
// ============================================================================

export interface MobileMediaSliderBlock {
  id: string;
  type: "mobile_media_slider";
  visibility: BlockVisibility;
  settings: {
    autoplay: boolean;
    autoplay_interval: number;  // ms
    show_dots: boolean;
    show_arrows: boolean;
    aspect_ratio: AspectRatio;
  };
  items: MediaItem[];
}

// ============================================================================
// Product Slider Block
// ============================================================================

export interface MobileProductSliderBlock {
  id: string;
  type: "mobile_product_slider";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    items_visible: number;      // 2-3 visible at once
    show_price: boolean;
    show_add_to_cart: boolean;
    source: ProductSource;
  };
  // If manual:
  product_codes?: string[];
  // If collection/category/tag:
  source_id?: string;
  // If search:
  search_query?: string;
  limit?: number;
  // Cached products for preview (populated from search API)
  _cached_products?: CachedProduct[];
}

// ============================================================================
// Media Gallery Block
// ============================================================================

export interface MobileMediaGalleryBlock {
  id: string;
  type: "mobile_media_gallery";
  visibility: BlockVisibility;
  settings: {
    columns: ColumnCount;
    gap: GapSize;
    aspect_ratio: AspectRatio;
  };
  items: MediaItem[];
}

// ============================================================================
// Product Gallery Block
// ============================================================================

export interface MobileProductGalleryBlock {
  id: string;
  type: "mobile_product_gallery";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    columns: ColumnCount;
    gap: GapSize;
    show_price: boolean;
    show_add_to_cart: boolean;
    card_style: "compact" | "detailed";
    source: ProductSource;
  };
  // Source config
  product_codes?: string[];
  source_id?: string;
  search_query?: string;
  limit?: number;
  // Cached products for preview (populated from search API)
  _cached_products?: CachedProduct[];
}

// ============================================================================
// Union Type for All Blocks
// ============================================================================

export type MobileBlock =
  | MobileMediaSliderBlock
  | MobileProductSliderBlock
  | MobileMediaGalleryBlock
  | MobileProductGalleryBlock;

// ============================================================================
// Mobile Home Configuration
// ============================================================================

export interface MobileHomeConfig {
  config_id: string;

  // App Identity (header logo + name)
  app_identity: MobileAppIdentity;

  // Content
  blocks: MobileBlock[];

  // Versioning
  version: number;
  is_draft: boolean;
  published_at?: Date;

  // Metadata
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Block Library Metadata
// ============================================================================

export interface MobileBlockMeta {
  type: MobileBlockType;
  name: string;
  description: string;
  icon: string;  // Lucide icon name
}

export const MOBILE_BLOCK_LIBRARY: MobileBlockMeta[] = [
  {
    type: "mobile_media_slider",
    name: "Media Slider",
    description: "Horizontal swipeable media carousel",
    icon: "SlidersHorizontal",
  },
  {
    type: "mobile_product_slider",
    name: "Product Slider",
    description: "Horizontal product cards carousel",
    icon: "Package",
  },
  {
    type: "mobile_media_gallery",
    name: "Media Gallery",
    description: "Grid layout for images and videos",
    icon: "LayoutGrid",
  },
  {
    type: "mobile_product_gallery",
    name: "Product Gallery",
    description: "Grid layout for product cards",
    icon: "Grid3X3",
  },
];

// ============================================================================
// Default Block Creators
// ============================================================================

export function createDefaultMediaSliderBlock(id: string): MobileMediaSliderBlock {
  return {
    id,
    type: "mobile_media_slider",
    visibility: "all",
    settings: {
      autoplay: true,
      autoplay_interval: 5000,
      show_dots: true,
      show_arrows: false,
      aspect_ratio: "16:9",
    },
    items: [],
  };
}

export function createDefaultProductSliderBlock(id: string): MobileProductSliderBlock {
  return {
    id,
    type: "mobile_product_slider",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Featured Products",
      items_visible: 2,
      show_price: true,
      show_add_to_cart: false,
      source: "search",
    },
    search_query: "",
    limit: 10,
  };
}

export function createDefaultMediaGalleryBlock(id: string): MobileMediaGalleryBlock {
  return {
    id,
    type: "mobile_media_gallery",
    visibility: "all",
    settings: {
      columns: 2,
      gap: "sm",
      aspect_ratio: "1:1",
    },
    items: [],
  };
}

export function createDefaultProductGalleryBlock(id: string): MobileProductGalleryBlock {
  return {
    id,
    type: "mobile_product_gallery",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Products",
      columns: 2,
      gap: "sm",
      show_price: true,
      show_add_to_cart: true,
      card_style: "compact",
      source: "search",
    },
    search_query: "",
    limit: 12,
  };
}

export function createDefaultBlock(type: MobileBlockType, id: string): MobileBlock {
  switch (type) {
    case "mobile_media_slider":
      return createDefaultMediaSliderBlock(id);
    case "mobile_product_slider":
      return createDefaultProductSliderBlock(id);
    case "mobile_media_gallery":
      return createDefaultMediaGalleryBlock(id);
    case "mobile_product_gallery":
      return createDefaultProductGalleryBlock(id);
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}
