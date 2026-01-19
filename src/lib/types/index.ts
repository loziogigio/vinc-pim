/**
 * Centralized Type Definitions
 *
 * This is the single source of truth for all shared types.
 * Import types from here or from specific sub-modules.
 *
 * Usage:
 *   import { MultiLangString, SearchRequest, BrandEmbedded } from "@/lib/types";
 *   // OR
 *   import { MultiLangString } from "@/lib/types/pim";
 *   import { SearchRequest } from "@/lib/types/search";
 *   import { BrandEmbedded } from "@/lib/types/entities";
 */

// PIM types (multilingual, product data, etc.)
export * from './pim';

// Search & Faceting types (Solr integration)
export * from './search';

// Order/Cart types
export * from './order';

// Customer types
export * from './customer';

// Entity types (Brand, Category, Collection, ProductType, Tag)
// Note: Some types overlap with search.ts (hierarchy items, features)
// Entity types are for MongoDB embedding, search types are for Solr response
export {
  // Brand types
  BrandBase,
  BrandEmbedded,
  BrandDocument,
  BrandHierarchyItem as BrandEntityHierarchyItem,
  // Category types
  CategoryBase,
  CategoryEmbedded,
  CategoryDocument,
  CategoryHierarchyItem as CategoryEntityHierarchyItem,
  // Collection types
  CollectionBase,
  CollectionEmbedded,
  CollectionDocument,
  CollectionHierarchyItem as CollectionEntityHierarchyItem,
  // Product Type types
  ProductTypeBase,
  ProductTypeEmbedded,
  ProductTypeDocument,
  ProductTypeFeature as ProductTypeEntityFeature,
  ProductTypeHierarchyItem as ProductTypeEntityHierarchyItem,
  // Tag types
  TagBase,
  TagEmbedded,
  TagDocument,
  TagGroupData,
} from './entities';
