/**
 * PIM Product Model
 * Product Information Management with versioning and auto-publish
 *
 * STRUCTURE STANDARD:
 * 1. PIM Metadata (versioning, quality, analytics)
 * 2. Product Core Data (matches Product interface exactly)
 * 3. Timestamps
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  BrandEmbedded,
  CategoryEmbedded,
  CollectionEmbedded,
  ProductTypeEmbedded,
  TagEmbedded,
} from "@/lib/types/entities";
import type { MultilingualText } from "@/lib/types/pim";

// Re-export for backwards compatibility
export type { MultilingualText };

// Helper type for language codes (for stricter typing in function params)
export type SupportedLanguage = string;

// ============================================
// REUSABLE PRICING TYPE
// ============================================
/**
 * Pricing structure used for products and packaging options.
 * - list: User's purchase/cost price (from price list)
 * - retail: MSRP / suggested retail price (gross_price from ERP)
 * - sale: Discounted price (price_discount from ERP)
 * - currency: Currency code (EUR, USD, etc.)
 * - vat_rate: VAT percentage (22, 10, 4, 0)
 */
export interface ProductPricing {
  list: number;                   // User's purchase/cost price
  retail?: number;                // MSRP / suggested retail price
  sale?: number;                  // Discounted price (if applicable)
  currency: string;               // Currency code (EUR, USD, etc.)
  vat_rate?: number;              // VAT percentage (22, 10, 4, 0)
}

/**
 * Partial pricing for packaging options (all fields optional)
 * Supports reference-based pricing with discounts
 */
export interface PackagingPricing {
  // Package prices (total for this packaging)
  list?: number;                  // List price for this packaging
  retail?: number;                // MSRP for this packaging
  sale?: number;                  // Discounted price for this packaging
  // Unit prices (price per single unit)
  list_unit?: number;             // List price per unit (list / qty)
  retail_unit?: number;           // MSRP per unit (retail / qty)
  sale_unit?: number;             // Sale price per unit (sale / qty)
  // Reference-based pricing fields
  price_ref?: string;             // Reference packaging code (e.g., "PZ" for BOX)
  list_discount_pct?: number;     // Percentage discount from retail to get list (e.g., 50 for -50%)
  list_discount_amt?: number;     // Fixed amount discount from retail to get list (e.g., 5 for -€5)
  sale_discount_pct?: number;     // Percentage discount from list to get sale (e.g., 10 for -10%)
  sale_discount_amt?: number;     // Fixed amount discount from list to get sale (e.g., 5 for -€5)
}

export interface IPIMProduct extends Document {
  // ============================================
  // SECTION 1: PIM METADATA
  // ============================================

  // Identity & Ownership
  // wholesaler_id removed - database per wholesaler provides isolation
  entity_code: string; // Unique product identifier

  // Versioning System
  version: number; // 1, 2, 3...
  isCurrent: boolean; // Is this the latest version?
  isCurrentPublished: boolean; // Is this version published?

  // Publication
  status: "draft" | "published" | "archived";
  published_at?: Date;

  // Import Source
  source: {
    source_id: string;
    source_name: string;
    batch_id?: string;
    batch_metadata?: {
      batch_id: string;
      batch_part: number;
      batch_total_parts: number;
      batch_total_items: number;
    };
    imported_at: Date;
  };

  // ERP Creation Date (when item was originally inserted in ERP)
  item_creation_date?: Date;

  // Quality Score (0-100)
  completeness_score: number;
  critical_issues: string[];

  // Auto-Publish Rules
  auto_publish_enabled: boolean;
  auto_publish_eligible: boolean;
  auto_publish_reason?: string;
  min_score_threshold: number;
  required_fields: string[];

  // Analytics
  analytics: {
    views_30d: number;
    clicks_30d: number;
    add_to_cart_30d: number;
    conversions_30d: number;
    priority_score: number;
    last_synced_at?: Date;
  };

  // Manual Editing
  locked_fields: string[]; // Fields protected from auto-import
  manually_edited: boolean;
  edited_by?: string;
  edited_at?: Date;

  // Conflict Tracking (Manual vs API Updates)
  last_api_update_at?: Date; // Last time API updated this product
  last_manual_update_at?: Date; // Last time manually edited
  manually_edited_fields: string[]; // Specific fields edited manually
  has_conflict: boolean; // Whether there's an active conflict
  conflict_data?: {
    field: string;
    manual_value: any;
    api_value: any;
    detected_at: Date;
  }[];

  // ============================================
  // SECTION 2: PRODUCT CORE DATA
  // (Matches Product interface from customer_web)
  // ============================================

  // Basic Info
  sku: string;
  name: MultilingualText;           // Multilingual: "it": "Trapano...", "de": "Schlagbohrmaschine...", etc.
  slug: MultilingualText;           // Multilingual: "it": "trapano-battente...", "de": "schlagbohrmaschine...", etc.
  description?: MultilingualText;   // Multilingual: "it": "Il trapano...", "de": "Die Bosch...", etc.

  // Product Images Array (first image [position 0] is the cover/main image)
  images?: {
    url: string;
    cdn_key: string;
    position: number;
    file_name?: string;
    file_type?: string;
    size_bytes?: number;
    uploaded_at: Date;
    uploaded_by: string;
  }[];

  // Media Files (documents, videos, 3D models, URLs with labels)
  // Supports both uploaded files and external URLs (YouTube, Vimeo, etc.)
  media?: {
    type: "document" | "video" | "3d-model";
    url: string;           // S3/CDN URL or external URL (YouTube, Vimeo, etc.)
    s3_key?: string;       // S3 key (empty for external links)
    label: MultilingualText; // Multilingual label: "it": "Manuale d'uso italiano", "de": "Bedienungsanleitung", etc.
    language?: SupportedLanguage; // Primary language of the media file (e.g., "it" for Italian manual)
    file_type?: string;    // MIME type (e.g., "application/pdf", "video/mp4")
    size_bytes?: number;   // File size (optional for external links)
    uploaded_at?: Date;
    uploaded_by?: string;
    is_external_link?: boolean; // true for YouTube/Vimeo/external URLs, false for S3 uploads
    position: number;      // Display order (0, 1, 2...)
  }[];

  // Inventory
  quantity: number;
  sold: number;
  unit: string;

  // Brand (Brand type - matches Brand model)
  brand?: BrandEmbedded;

  // Category (Category type)
  category?: CategoryEmbedded;

  // Collections (can have multiple)
  collections?: CollectionEmbedded[];

  // Product Type (with features)
  product_type?: ProductTypeEmbedded;

  // Attributes (Product properties with labels)
  // Multilingual structure: attributes organized by language
  attributes?: {
    [K in SupportedLanguage]?: {
      key: string;        // Programmatic key (e.g., "color", "material")
      label: string;      // Display label in this language (e.g., "Colore" for IT, "Farbe" for DE)
      value: any;         // Attribute value (can be translated or universal)
    }[];
  };

  // Tags (for marketing, SEO, filtering - e.g., "bestseller", "featured", "eco-friendly")
  tags?: TagEmbedded[];

  // Synonym dictionary keys (for search synonyms - references SynonymDictionary.key)
  synonym_keys?: string[];

  // Marketing Features (Marketing highlights - "Caratteristiche")
  // Multilingual structure: features organized by language
  // Example: { "it": ["Ricarica wireless", "Resistente all'acqua IP68"], "de": [...] }
  marketing_features?: {
    [K in SupportedLanguage]?: string[];
  };

  // Technical Specifications (Technical data - "Specifiche tecniche")
  // Multilingual structure: specifications organized by language (labels translated, values stay same)
  technical_specifications?: {
    [K in SupportedLanguage]?: {
      key: string;        // Programmatic key (e.g., "weight", "dimensions")
      label: string;      // Display label in this language (e.g., "Peso" for IT, "Gewicht" for DE)
      value: string | number; // Specification value (universal)
      uom?: string;       // Unit of measure (e.g., "kg", "cm", "W")
      category?: string;  // Group specs (translated or universal)
      order?: number;     // Display order
    }[];
  };

  // Metadata
  meta?: {
    key: string;
    value: string;
  }[];

  // Variations & Faceting Control
  parent_sku?: string;
  parent_entity_code?: string;
  variants_sku?: string[]; // Array of child SKUs
  variants_entity_code?: string[]; // Array of child entity_codes

  /**
   * SELF-CONTAINED: Full parent product data
   * Critical for variant listing views without database lookups
   * Enables displaying parent context in search results and variant selectors
   */
  parent_product?: {
    entity_code: string;
    sku: string;
    name: MultilingualText;
    slug: MultilingualText;
    cover_image_url?: string;
    price?: number;
    brand?: BrandEmbedded;
    category?: CategoryEmbedded;
  };

  /**
   * SELF-CONTAINED: Sibling variants data
   * Enables "other colors/sizes" display without additional queries
   * Only includes other variants (excludes current product)
   */
  sibling_variants?: Array<{
    entity_code: string;
    sku: string;
    name: MultilingualText;
    variant_attributes?: Record<string, any>; // color, size, etc.
    cover_image_url?: string;
    price?: number;
    stock_status?: string;
    is_active?: boolean;
  }>;

  /**
   * Indicates if this product is a parent product
   * - Single products (no variants): is_parent = true
   * - Parent products with variants: is_parent = true
   * - Variant products (children): is_parent = false
   * Default: true
   */
  is_parent?: boolean;

  /**
   * Controls whether this product should be included in Solr faceting/filtering
   * - Single products (no variants): include_faceting = true
   * - Parent products with variants: include_faceting = false (exclude from facets, group only)
   * - Variant products (children): include_faceting = true (include in facets)
   * Default: true
   */
  include_faceting?: boolean;

  /**
   * When true, this parent product's IMAGES will be
   * appended to all child variants in search results.
   * Only applicable to parent products (is_parent = true).
   * Default: false
   */
  share_images_with_variants?: boolean;

  /**
   * When true, this parent product's ADDITIONAL MEDIA (documents, videos, 3D models)
   * will be appended to all child variants in search results.
   * Only applicable to parent products (is_parent = true).
   * Default: false
   */
  share_media_with_variants?: boolean;

  // Additional Product Fields
  product_model?: string;
  ean?: string[];                         // EAN barcodes (array for multiple codes)
  short_description?: MultilingualText;   // Multilingual: "it": "Trapano professionale 750W...", etc.
  long_description?: MultilingualText;    // Multilingual: "it": "Descrizione completa...", etc.
  product_status?: string;
  product_status_description?: MultilingualText; // Multilingual: "it": "Disponibile", "de": "Verfügbar", etc.
  stock_status?: "in_stock" | "out_of_stock" | "pre_order";

  // Physical Attributes
  weight?: number;           // Weight value (e.g., 0.12)
  weight_uom?: string;       // Weight unit of measure (e.g., "KG", "G", "LB")
  volume?: number;           // Volume value (e.g., 420)
  volume_uom?: string;       // Volume unit of measure (e.g., "CM3", "L", "ML")
  dimension_height?: number; // Height (e.g., 3.5)
  dimension_width?: number;  // Width (e.g., 4.5)
  dimension_length?: number; // Length (e.g., 26.8)
  dimension_uom?: string;    // Dimension unit of measure (e.g., "CM", "MM", "M")

  // ERP Specific - Packaging Options with embedded promotions
  packaging_options?: {
    id?: string;              // Optional unique ID
    pkg_id?: string;          // Unique packaging identifier (incremental: "1", "2", "3"...)
    code: string;             // Packaging code (e.g., "PZ", "BOX", "CF", "PALLET")
    label: MultilingualText;  // Multilingual: "it": "Pezzo singolo", "de": "Einzelstück", etc.
    qty: number;              // Quantity per packaging unit
    uom: string;              // Unit of measure (e.g., "PZ")
    is_default: boolean;      // Is this the default packaging?
    is_smallest: boolean;     // Is this the smallest unit?
    is_sellable?: boolean;    // Can this packaging be sold? (default: true)
    ean?: string;             // EAN barcode (optional)
    position?: number;        // Display order (optional)
    pricing?: PackagingPricing; // Optional pricing override for this packaging
    // Promotions specific to this packaging option
    promotions?: {
      promo_code?: string;            // Promotion code (e.g., "016", "BREVE-SCAD")
      promo_row?: number;             // Row number from ERP (for tracking/sorting)
      is_active: boolean;
      promo_type?: string;            // Business category (STD, XXX, OMG, EOL, BREVE-SCAD, etc.)
      calc_method?: string;           // Calculation method (RPNQMIN, RQCSC, RVMSC, RCNA, RQCOE)
      label: MultilingualText;        // Multilingual promotion label
      language?: SupportedLanguage;   // Primary language of the promotion
      discount_percentage?: number;   // Percentage discount (e.g., 20 for 20% off)
      discount_amount?: number;       // Fixed amount discount (e.g., 10.00 for €10 off)
      buy_x?: number;                 // Buy X quantity (for buy_x_get_y type)
      get_y?: number;                 // Get Y quantity (for buy_x_get_y type)
      is_stackable: boolean;          // Can be combined with other promotions
      priority: number;               // Priority order (higher = more important)
      start_date?: Date;              // Promotion start date
      end_date?: Date;                // Promotion end date
      min_quantity?: number;          // Minimum quantity to qualify
      min_order_value?: number;       // Minimum order value to qualify
      promo_price?: number;           // Final price when this promotion applies
    }[];
  }[];

  // Product-level promotions (source of truth — computed into packaging on GET)
  promotions?: {
    promo_code?: string;            // Promotion code (e.g., "016")
    promo_row?: number;             // Row number from ERP (for tracking/sorting)
    is_active: boolean;
    promo_type?: string;            // Business category (ctipo_dtpro: STD, XXX, OMG, EOL, etc.)
    calc_method?: string;           // Calculation method (ctipo_dprom: RPNQMIN, RQCSC, RVMSC, RCNA, RQCOE)
    label: MultilingualText;        // Multilingual: "it": "Promozione di Natale", "de": "Weihnachtsaktion", etc.
    language?: SupportedLanguage;   // Primary language of the promotion (optional)
    discount_percentage?: number;   // Percentage discount (e.g., 20 for 20% off)
    discount_amount?: number;       // Fixed amount discount (e.g., 10.00 for €10 off)
    buy_x?: number;                 // Buy X quantity (for buy_x_get_y type)
    get_y?: number;                 // Get Y quantity (for buy_x_get_y type)
    is_stackable: boolean;          // Can be combined with other promotions
    priority: number;               // Priority order (higher = more important)
    start_date?: Date;              // Promotion start date
    end_date?: Date;                // Promotion end date
    min_quantity?: number;          // Minimum quantity to qualify
    min_order_value?: number;       // Minimum order value to qualify
    promo_price?: number;           // Final price when this promotion applies
    target_pkg_ids?: string[];      // Target packaging options — empty = all sellable
  }[];

  // Product-level promotion fields (for faceting/filtering)
  promo_code?: string[];            // Array of active promotion codes (e.g., ["016", "017"])
  promo_type?: string[];            // Array of business categories (ctipo_dtpro: STD, XXX, OMG, EOL, etc.)
  has_active_promo?: boolean;       // Has any active promotion

  // Pricing (from ERP or manual entry)
  pricing?: ProductPricing;

  // SEO
  meta_title?: MultilingualText;        // Multilingual: "it": "Bosch PSB 750 - Trapano...", etc.
  meta_description?: MultilingualText;  // Multilingual: "it": "Acquista il trapano...", etc.

  // ============================================
  // SECTION 3: TIMESTAMPS
  // ============================================
  created_at: Date;
  updated_at: Date;
}

// Dynamic Multilingual Text Schema Helper
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createMultilingualTextSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Marketing Features Schema (array of strings per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createMarketingFeaturesSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Technical Specifications Schema (structured array per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createTechnicalSpecificationsSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Attributes Schema (structured array per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createAttributesSchema = () => {
  return { type: Schema.Types.Mixed };
};

const MultilingualTextSchema = createMultilingualTextSchema();
const MarketingFeaturesSchema = createMarketingFeaturesSchema();
const TechnicalSpecificationsSchema = createTechnicalSpecificationsSchema();
const AttributesSchema = createAttributesSchema();

// Source sub-schema (strict: false allows batch_metadata without defining it)
const SourceSchema = new Schema({
  source_id: { type: String, required: true, index: true },
  source_name: { type: String, required: true },
  batch_id: { type: String, index: true },
  imported_at: { type: Date, required: true },
}, { _id: false, strict: false });

const PIMProductSchema = new Schema<IPIMProduct>(
  {
    // ============================================
    // SECTION 1: PIM METADATA
    // ============================================

    // wholesaler_id removed - database per wholesaler provides isolation
    entity_code: { type: String, required: true, index: true },

    version: { type: Number, required: true, default: 1 },
    isCurrent: { type: Boolean, required: true, default: true },
    isCurrentPublished: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    published_at: { type: Date },

    source: SourceSchema,

    // ERP Creation Date (when item was originally inserted in ERP)
    item_creation_date: { type: Date, index: true },

    completeness_score: { type: Number, min: 0, max: 100, index: true, default: 0 },
    critical_issues: [{ type: String }],

    auto_publish_enabled: { type: Boolean, default: false },
    auto_publish_eligible: { type: Boolean, default: false },
    auto_publish_reason: { type: String },
    min_score_threshold: { type: Number, default: 80 },
    required_fields: [{ type: String }],

    analytics: {
      views_30d: { type: Number, default: 0 },
      clicks_30d: { type: Number, default: 0 },
      add_to_cart_30d: { type: Number, default: 0 },
      conversions_30d: { type: Number, default: 0 },
      priority_score: { type: Number, default: 0, index: true },
      last_synced_at: { type: Date },
    },

    locked_fields: [{ type: String }],
    manually_edited: { type: Boolean, default: false },
    edited_by: { type: String },
    edited_at: { type: Date },

    // Conflict Tracking
    last_api_update_at: { type: Date },
    last_manual_update_at: { type: Date },
    manually_edited_fields: [{ type: String }],
    has_conflict: { type: Boolean, default: false, index: true },
    conflict_data: [
      {
        field: { type: String, required: true },
        manual_value: { type: Schema.Types.Mixed },
        api_value: { type: Schema.Types.Mixed },
        detected_at: { type: Date, required: true },
      },
    ],

    // ============================================
    // SECTION 2: PRODUCT CORE DATA
    // ============================================

    sku: { type: String, required: true, index: true },
    name: MultilingualTextSchema,
    slug: MultilingualTextSchema,
    description: MultilingualTextSchema,

    // Product Images Array (first image [position 0] is the cover/main image)
    images: [
      {
        url: { type: String, required: true },
        cdn_key: { type: String, required: true },
        position: { type: Number, required: true, default: 0 },
        file_name: { type: String },
        file_type: { type: String },
        size_bytes: { type: Number },
        uploaded_at: { type: Date },
        uploaded_by: { type: String },
      },
    ],

    // Media Files (documents, videos, 3D models, URLs with labels)
    media: [
      {
        type: { type: String, enum: ["document", "video", "3d-model"], required: true },
        url: { type: String, required: true },
        s3_key: { type: String },
        label: MultilingualTextSchema,
        language: { type: String }, // Validated at runtime via middleware
        file_type: { type: String },
        size_bytes: { type: Number },
        uploaded_at: { type: Date },
        uploaded_by: { type: String },
        is_external_link: { type: Boolean, default: false },
        position: { type: Number, required: true, default: 0 },
      },
    ],

    quantity: { type: Number, required: true, default: 0 },
    sold: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true, default: "pcs" },

    brand: {
      brand_id: { type: String },
      label: { type: String },
      slug: { type: String },
      description: { type: String },
      logo_url: { type: String },
      website_url: { type: String },
      is_active: { type: Boolean },
      product_count: { type: Number },
      display_order: { type: Number },
      // SELF-CONTAINED: Brand hierarchy fields (for brand families)
      parent_brand_id: { type: String },
      brand_family: { type: String },
      level: { type: Number },
      path: [{ type: String }],
      hierarchy: [
        {
          brand_id: { type: String },
          label: { type: String },
          slug: { type: String },
          logo_url: { type: String },
          level: { type: Number },
        },
      ],
    },

    category: {
      category_id: { type: String },
      name: MultilingualTextSchema,
      slug: MultilingualTextSchema,
      details: MultilingualTextSchema,
      image: {
        id: { type: String },
        thumbnail: { type: String },
        original: { type: String },
      },
      icon: { type: String },
      // SELF-CONTAINED: Hierarchy fields
      parent_id: { type: String },
      level: { type: Number },
      path: [{ type: String }],
      hierarchy: [
        {
          category_id: { type: String },
          name: MultilingualTextSchema,
          slug: MultilingualTextSchema,
          level: { type: Number },
          description: { type: String },
          image: {
            id: { type: String },
            thumbnail: { type: String },
            original: { type: String },
          },
          icon: { type: String },
        },
      ],
      description: { type: String },
      is_active: { type: Boolean },
      product_count: { type: Number },
      display_order: { type: Number },
    },

    collections: [
      {
        collection_id: { type: String },
        name: MultilingualTextSchema,
        slug: MultilingualTextSchema,
        description: { type: String },
        is_active: { type: Boolean },
        product_count: { type: Number },
        display_order: { type: Number },
        // SELF-CONTAINED: Collection hierarchy fields
        parent_collection_id: { type: String },
        level: { type: Number },
        path: [{ type: String }],
        hierarchy: [
          {
            collection_id: { type: String },
            name: MultilingualTextSchema,
            slug: MultilingualTextSchema,
            level: { type: Number },
            description: { type: String },
          },
        ],
      },
    ],

    product_type: {
      product_type_id: { type: String },
      code: { type: String },  // Customer's ERP code (e.g., "001", "037")
      name: MultilingualTextSchema,
      slug: MultilingualTextSchema,
      technical_specifications: [
        {
          technical_specification_id: { type: String },
          key: { type: String },
          label: MultilingualTextSchema,
          type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean"] },
          value: { type: Schema.Types.Mixed },
          unit: { type: String },
          options: [{ type: String }],
          required: { type: Boolean },
          display_order: { type: Number },
        },
      ],
      description: { type: String },
      is_active: { type: Boolean },
      product_count: { type: Number },
      display_order: { type: Number },
      // SELF-CONTAINED: Product type hierarchy fields
      parent_type_id: { type: String },
      level: { type: Number },
      path: [{ type: String }],
      hierarchy: [
        {
          product_type_id: { type: String },
          name: MultilingualTextSchema,
          slug: MultilingualTextSchema,
          level: { type: Number },
          description: { type: String },
          technical_specifications: [
            {
              technical_specification_id: { type: String },
              key: { type: String },
              label: MultilingualTextSchema,
              type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean"] },
              unit: { type: String },
              options: [{ type: String }],
              required: { type: Boolean },
              display_order: { type: Number },
            },
          ],
        },
      ],
      // Accumulated technical specifications from all parent types
      inherited_technical_specifications: [
        {
          technical_specification_id: { type: String },
          key: { type: String },
          label: MultilingualTextSchema,
          type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean"] },
          unit: { type: String },
          options: [{ type: String }],
          required: { type: Boolean },
          display_order: { type: Number },
        },
      ],
    },

    // Attributes (Product properties with labels) - dynamically organized by language
    attributes: AttributesSchema,

    // Tags (for marketing, SEO, filtering)
    tags: [
      {
        tag_id: { type: String, required: true },
        name: MultilingualTextSchema,
        slug: { type: String, required: true },
        description: { type: String },
        color: { type: String },
        is_active: { type: Boolean },
        product_count: { type: Number },
        display_order: { type: Number },
        // SELF-CONTAINED: Tag categorization
        tag_category: { type: String },
        tag_group: { type: String },
        tag_group_data: {
          group_id: { type: String },
          group_name: MultilingualTextSchema,
          group_slug: { type: String },
          group_type: { type: String },
          display_order: { type: Number },
        },
      },
    ],

    // Synonym dictionary keys (for search synonyms)
    synonym_keys: [{ type: String }],

    // Marketing Features (Marketing highlights - dynamically organized by language)
    marketing_features: MarketingFeaturesSchema,

    // Technical Specifications (Technical data - dynamically organized by language)
    technical_specifications: TechnicalSpecificationsSchema,

    meta: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],

    parent_sku: { type: String },
    parent_entity_code: { type: String },
    variants_sku: [{ type: String }],
    variants_entity_code: [{ type: String }],

    // Parent product data (self-contained)
    parent_product: {
      entity_code: { type: String },
      sku: { type: String },
      name: MultilingualTextSchema,
      slug: MultilingualTextSchema,
      cover_image_url: { type: String },
      price: { type: Number },
      brand: {
        brand_id: { type: String },
        label: { type: String },
        slug: { type: String },
      },
      category: {
        category_id: { type: String },
        name: MultilingualTextSchema,
        slug: MultilingualTextSchema,
      },
    },

    // Sibling variants (self-contained)
    sibling_variants: [
      {
        entity_code: { type: String },
        sku: { type: String },
        name: MultilingualTextSchema,
        variant_attributes: { type: Schema.Types.Mixed },
        cover_image_url: { type: String },
        price: { type: Number },
        stock_status: { type: String },
        is_active: { type: Boolean },
      },
    ],

    is_parent: { type: Boolean, default: true },
    include_faceting: { type: Boolean, default: true },
    share_images_with_variants: { type: Boolean, default: false },
    share_media_with_variants: { type: Boolean, default: false },

    product_model: { type: String },
    ean: [{ type: String }],
    short_description: MultilingualTextSchema,
    long_description: MultilingualTextSchema,
    product_status: { type: String },
    product_status_description: MultilingualTextSchema,
    stock_status: {
      type: String,
      enum: ["in_stock", "out_of_stock", "pre_order"],
    },

    // Physical Attributes
    weight: { type: Number },
    weight_uom: { type: String },
    volume: { type: Number },
    volume_uom: { type: String },
    dimension_height: { type: Number },
    dimension_width: { type: Number },
    dimension_length: { type: Number },
    dimension_uom: { type: String },

    packaging_options: [
      {
        id: { type: String },
        pkg_id: { type: String },             // Unique packaging identifier (incremental: "1", "2", "3"...)
        code: { type: String, required: true },
        label: MultilingualTextSchema,
        qty: { type: Number, required: true },
        uom: { type: String, required: true },
        is_default: { type: Boolean, required: true, default: false },
        is_smallest: { type: Boolean, required: true, default: false },
        is_sellable: { type: Boolean, default: true },
        ean: { type: String },
        position: { type: Number },
        // Pricing (PackagingPricing) with reference-based pricing support
        pricing: {
          // Package prices (total for this packaging)
          list: { type: Number },
          retail: { type: Number },
          sale: { type: Number },
          // Unit prices (price per single unit)
          list_unit: { type: Number },
          retail_unit: { type: Number },
          sale_unit: { type: Number },
          // Reference-based pricing fields
          price_ref: { type: String },
          list_discount_pct: { type: Number },
          list_discount_amt: { type: Number },
          sale_discount_pct: { type: Number },
          sale_discount_amt: { type: Number },
          // Customer tag filter — empty = all customers, otherwise requires matching tag
          tag_filter: [{ type: String }],
        },
        // Promotions specific to this packaging option
        promotions: [
          {
            promo_code: { type: String },
            promo_row: { type: Number },             // Row number from ERP
            is_active: { type: Boolean, required: true, default: true },
            promo_type: { type: String },           // Business category (STD, XXX, OMG, EOL, BREVE-SCAD, etc.)
            calc_method: { type: String },          // Calculation method (RPNQMIN, RQCSC, RVMSC, etc.)
            label: MultilingualTextSchema,
            language: { type: String },
            discount_percentage: { type: Number },
            discount_amount: { type: Number },
            buy_x: { type: Number },
            get_y: { type: Number },
            is_stackable: { type: Boolean, required: true, default: false },
            priority: { type: Number, required: true, default: 0 },
            start_date: { type: Date },
            end_date: { type: Date },
            min_quantity: { type: Number },
            min_order_value: { type: Number },
            promo_price: { type: Number },          // Final price when this promotion applies
            // Customer tag filter — empty = all customers, otherwise requires matching tag
            tag_filter: [{ type: String }],
          },
        ],
      },
    ],

    // Product-level promotions (source of truth — computed into packaging on GET)
    promotions: [
      {
        promo_code: { type: String },
        promo_row: { type: Number },                // Row number from ERP
        is_active: { type: Boolean, required: true, default: true },
        promo_type: { type: String },               // Business category (STD, XXX, OMG, EOL, etc.)
        calc_method: { type: String },              // Calculation method (RPNQMIN, RQCSC, RVMSC, etc.)
        label: MultilingualTextSchema,
        language: { type: String },
        discount_percentage: { type: Number },
        discount_amount: { type: Number },
        buy_x: { type: Number },
        get_y: { type: Number },
        is_stackable: { type: Boolean, required: true, default: false },
        priority: { type: Number, required: true, default: 0 },
        start_date: { type: Date },
        end_date: { type: Date },
        min_quantity: { type: Number },
        min_order_value: { type: Number },
        promo_price: { type: Number },              // Final price when this promotion applies
        // Target packaging options — empty = all sellable; otherwise specific pkg_ids
        target_pkg_ids: [{ type: String }],
        // Customer tag filter — empty = all customers, otherwise requires matching tag
        tag_filter: [{ type: String }],
      },
    ],

    // Product-level promotion fields (for faceting/filtering)
    promo_code: [{ type: String }],               // Array of active promotion codes
    promo_type: [{ type: String }],               // Array of business categories for faceting
    has_active_promo: { type: Boolean, default: false },

    // Pricing (ProductPricing)
    pricing: {
      list: { type: Number },                     // User's purchase/cost price
      retail: { type: Number },                   // MSRP / suggested retail price
      sale: { type: Number },                     // Discounted price
      currency: { type: String },                 // Currency code (EUR, USD, etc.)
      vat_rate: { type: Number },                 // VAT percentage (22, 10, 4, 0)
    },

    meta_title: MultilingualTextSchema,
    meta_description: MultilingualTextSchema,

    // ============================================
    // SECTION 3: TIMESTAMPS
    // ============================================
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound indexes for performance (no wholesaler_id - database provides isolation)
PIMProductSchema.index({ entity_code: 1, version: 1 });
PIMProductSchema.index({ entity_code: 1, isCurrent: 1 });
PIMProductSchema.index({ status: 1, completeness_score: -1 });
PIMProductSchema.index({ "analytics.priority_score": -1 });
PIMProductSchema.index({ "source.source_id": 1, status: 1 });
PIMProductSchema.index({ item_creation_date: -1 }); // For ERP insertion date sorting

export { PIMProductSchema };

export const PIMProductModel =
  mongoose.models.PIMProduct ||
  mongoose.model<IPIMProduct>("PIMProduct", PIMProductSchema);
