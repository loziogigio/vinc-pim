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

/** Whether the mobile app requires login */
export type AppAccessMode = "public" | "private";

export interface MobileAppIdentity {
  app_name: string;
  logo_url: string;
  logo_width: number;   // px
  logo_height?: number; // px, optional (maintain aspect ratio)
  primary_color: string; // hex color for buttons (e.g., "#ec4899")
  access_mode: AppAccessMode; // "public" = no login, "private" = login required
}

export const DEFAULT_APP_IDENTITY: MobileAppIdentity = {
  app_name: "",
  logo_url: "",
  logo_width: 64,
  primary_color: "#ec4899", // pink-500 default
  access_mode: "public",
};

// ============================================================================
// Block Types
// ============================================================================

export const MOBILE_BLOCK_TYPES = [
  "mobile_media_slider",
  "mobile_product_slider",
  "mobile_media_gallery",
  "mobile_product_gallery",
  "mobile_category_slider",
  "mobile_category_gallery",
  "mobile_entity_slider",
  "mobile_entity_gallery",
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

export type ProductSource = "manual" | "collection" | "category" | "tag" | "search" | "trending" | "liked";

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
// Category Blocks
// ============================================================================

/** Cached category data for preview */
export interface CachedCategory {
  category_id: string;
  name: string;
  slug: string;
  hero_image_url?: string;
  product_count: number;
}

export interface MobileCategorySliderBlock {
  id: string;
  type: "mobile_category_slider";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    items_visible: number;
    show_product_count: boolean;
  };
  selected_category_ids?: string[];
  _cached_categories?: CachedCategory[];
}

export interface MobileCategoryGalleryBlock {
  id: string;
  type: "mobile_category_gallery";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    columns: ColumnCount;
    gap: GapSize;
    show_product_count: boolean;
  };
  selected_category_ids?: string[];
  _cached_categories?: CachedCategory[];
}

// ============================================================================
// Entity Blocks (Brand / Collection / Product Type)
// ============================================================================

/** Which entity type to load for entity slider/gallery blocks */
export const ENTITY_SOURCES = ["brand", "collection", "product_type"] as const;
export type EntitySource = (typeof ENTITY_SOURCES)[number];

/** Human-readable labels for entity source dropdown */
export const ENTITY_SOURCE_LABELS: Record<EntitySource, string> = {
  brand: "Brands",
  collection: "Collections",
  product_type: "Product Types",
};

/** API endpoints to fetch entities by source */
export const ENTITY_SOURCE_API: Record<EntitySource, string> = {
  brand: "/api/b2b/pim/brands",
  collection: "/api/b2b/pim/collections",
  product_type: "/api/b2b/pim/product-types",
};

/**
 * Maps entity source to the search filter parameter name.
 * The mobile app builds search URLs like: `shop?filters-{param}={value}`
 */
export const ENTITY_SEARCH_FILTER: Record<EntitySource, string> = {
  brand: "brand_id",
  collection: "collection_slugs",
  product_type: "product_type_code",
};

/** Generic cached entity data for preview — normalized shape across all entity types */
export interface CachedEntity {
  /** Entity ID (brand_id / collection_id / product_type_id) */
  id: string;
  /** Display name (resolved to string) */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Image URL (logo_url for brands, hero_image.url for collections, undefined for product types) */
  image_url?: string;
  /** Number of products in this entity */
  product_count: number;
  /** Value used by the mobile app in the search filter URL */
  filter_value: string;
}

export interface MobileEntitySliderBlock {
  id: string;
  type: "mobile_entity_slider";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    items_visible: number;
    show_product_count: boolean;
    entity_source: EntitySource;
  };
  _cached_entities?: CachedEntity[];
}

export interface MobileEntityGalleryBlock {
  id: string;
  type: "mobile_entity_gallery";
  visibility: BlockVisibility;
  settings: {
    title?: string;
    show_title: boolean;
    columns: ColumnCount;
    gap: GapSize;
    show_product_count: boolean;
    entity_source: EntitySource;
  };
  _cached_entities?: CachedEntity[];
}

// ============================================================================
// Union Type for All Blocks
// ============================================================================

export type MobileBlock =
  | MobileMediaSliderBlock
  | MobileProductSliderBlock
  | MobileMediaGalleryBlock
  | MobileProductGalleryBlock
  | MobileCategorySliderBlock
  | MobileCategoryGalleryBlock
  | MobileEntitySliderBlock
  | MobileEntityGalleryBlock;

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
  {
    type: "mobile_category_slider",
    name: "Category Slider",
    description: "Horizontal category navigation",
    icon: "LayoutList",
  },
  {
    type: "mobile_category_gallery",
    name: "Category Gallery",
    description: "Grid layout for categories",
    icon: "FolderOpen",
  },
  {
    type: "mobile_entity_slider",
    name: "Entity Slider",
    description: "Auto-load brands, collections, or product types",
    icon: "Layers",
  },
  {
    type: "mobile_entity_gallery",
    name: "Entity Gallery",
    description: "Grid of brands, collections, or product types",
    icon: "LayoutDashboard",
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

export function createDefaultCategorySliderBlock(id: string): MobileCategorySliderBlock {
  return {
    id,
    type: "mobile_category_slider",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Categories",
      items_visible: 2,
      show_product_count: true,
    },
    selected_category_ids: [],
  };
}

export function createDefaultCategoryGalleryBlock(id: string): MobileCategoryGalleryBlock {
  return {
    id,
    type: "mobile_category_gallery",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Categories",
      columns: 2,
      gap: "sm",
      show_product_count: true,
    },
    selected_category_ids: [],
  };
}

export function createDefaultEntitySliderBlock(id: string): MobileEntitySliderBlock {
  return {
    id,
    type: "mobile_entity_slider",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Brands",
      items_visible: 2,
      show_product_count: true,
      entity_source: "brand",
    },
  };
}

export function createDefaultEntityGalleryBlock(id: string): MobileEntityGalleryBlock {
  return {
    id,
    type: "mobile_entity_gallery",
    visibility: "all",
    settings: {
      show_title: true,
      title: "Brands",
      columns: 2,
      gap: "sm",
      show_product_count: true,
      entity_source: "brand",
    },
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
    case "mobile_category_slider":
      return createDefaultCategorySliderBlock(id);
    case "mobile_category_gallery":
      return createDefaultCategoryGalleryBlock(id);
    case "mobile_entity_slider":
      return createDefaultEntitySliderBlock(id);
    case "mobile_entity_gallery":
      return createDefaultEntityGalleryBlock(id);
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}
