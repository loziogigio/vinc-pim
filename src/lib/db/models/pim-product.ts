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

// Dynamic Multilingual Text Field (supports any language - validated at runtime)
export type MultilingualText = Record<string, string>;

// Helper type for language codes (for stricter typing in function params)
export type SupportedLanguage = string;

// Shared Image Asset Type
export interface IImageAsset {
  id: string;
  url: string;
  s3_key?: string;
  uploaded_at?: Date;
  uploaded_by?: string;
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

  // Gallery Images (product photos - first image [position 0] is the cover/main image)
  gallery?: (IImageAsset & {
    label?: string;
    position: number;
  })[];

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

  // Brand (Brand type)
  brand?: {
    id: string;
    name: string;           // Brand name can be universal (e.g., "Bosch Professional")
    slug: string;
    image?: {
      id: string;
      thumbnail: string;
      original: string;
    };
  };

  // Category (Category type)
  category?: {
    id: string;
    name: MultilingualText;   // Multilingual: "it": "Trapani Battenti", "de": "Schlagbohrmaschinen", etc.
    slug: MultilingualText;   // Multilingual: "it": "trapani-battenti", "de": "schlagbohrmaschinen", etc.
    details?: MultilingualText; // Multilingual details/description
    image?: {
      id: string;
      thumbnail: string;
      original: string;
    };
    icon?: string;
  };

  // Collections (can have multiple)
  collections?: {
    id: string;
    name: MultilingualText;   // Multilingual: "it": "Utensili Elettrici", "de": "Elektrowerkzeuge", etc.
    slug: MultilingualText;   // Multilingual: "it": "utensili-elettrici", "de": "elektrowerkzeuge", etc.
  }[];

  // Product Type (with features)
  product_type?: {
    id: string;
    name: MultilingualText;   // Multilingual: "it": "Trapano", "de": "Bohrmaschine", etc.
    slug: MultilingualText;   // Multilingual: "it": "trapano", "de": "bohrmaschine", etc.
    features?: {
      key: string;
      label: MultilingualText; // Multilingual label
      value: string | number | boolean | string[];
      unit?: string;
    }[];
  };

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
  tags?: {
    id: string;
    name: MultilingualText;   // Multilingual: "it": "Più venduto", "de": "Bestseller", etc.
    slug: string;             // Slug can be universal (e.g., "bestseller")
  }[];

  // Features (Marketing highlights - "Caratteristiche")
  // Multilingual structure: features organized by language
  // Example: { "it": ["Ricarica wireless", "Resistente all'acqua IP68"], "de": [...] }
  features?: {
    [K in SupportedLanguage]?: string[];
  };

  // Specifications (Technical data - "Specifiche tecniche")
  // Multilingual structure: specifications organized by language (labels translated, values stay same)
  specifications?: {
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

  // Variations
  parent_sku?: string;
  parent_entity_code?: string;
  variations_sku?: string[]; // Array of child SKUs
  variations_entity_code?: string[]; // Array of child entity_codes

  // Additional Product Fields
  product_model?: string;
  ean?: string[];                         // EAN barcodes (array for multiple codes)
  short_description?: MultilingualText;   // Multilingual: "it": "Trapano professionale 750W...", etc.
  long_description?: MultilingualText;    // Multilingual: "it": "Descrizione completa...", etc.
  product_status?: string;
  product_status_description?: MultilingualText; // Multilingual: "it": "Disponibile", "de": "Verfügbar", etc.
  stock_status?: "in_stock" | "out_of_stock" | "pre_order";

  // ERP Specific - Packaging Options
  packaging_options?: {
    id?: string;              // Optional unique ID
    code: string;             // Packaging code (e.g., "MV", "IM", "CF", "PALLET")
    label: MultilingualText;  // Multilingual: "it": "Pezzo singolo", "de": "Einzelstück", etc.
    qty: number;              // Quantity per packaging unit
    uom: string;              // Unit of measure (e.g., "PZ")
    is_default: boolean;      // Is this the default packaging?
    is_smallest: boolean;     // Is this the smallest unit?
    ean?: string;             // EAN barcode (optional)
    position?: number;        // Display order (optional)
  }[];

  // Promotions (Denormalized for faceting/search - filtered at query time)
  // Each promotion is language-specific with translated label
  promotions?: {
    promo_code?: string;            // Promotion code (not promotion_id)
    is_active: boolean;
    promo_type?: "percentage" | "fixed_amount" | "amount" | "buy_x_get_y" | "bundle" | "free_shipping";
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
  }[];

  // SEO
  meta_title?: MultilingualText;        // Multilingual: "it": "Bosch PSB 750 - Trapano...", etc.
  meta_description?: MultilingualText;  // Multilingual: "it": "Acquista il trapano...", etc.

  // ============================================
  // SECTION 3: TIMESTAMPS
  // ============================================
  created_at: Date;
  updated_at: Date;
}

// Shared Image Asset Schema
const ImageAssetSchema = {
  id: { type: String, required: true },
  url: { type: String, required: true },
  s3_key: { type: String },
  uploaded_at: { type: Date },
  uploaded_by: { type: String },
};

// Dynamic Multilingual Text Schema Helper
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createMultilingualTextSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Features Schema (array of strings per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createFeaturesSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Specifications Schema (structured array per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createSpecificationsSchema = () => {
  return { type: Schema.Types.Mixed };
};

// Dynamic Attributes Schema (structured array per language)
// Uses Mixed type to support all languages (validated at runtime via middleware)
const createAttributesSchema = () => {
  return { type: Schema.Types.Mixed };
};

const MultilingualTextSchema = createMultilingualTextSchema();
const FeaturesSchema = createFeaturesSchema();
const SpecificationsSchema = createSpecificationsSchema();
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

    // Gallery Images (product photos - first image [position 0] is the cover/main image)
    gallery: [
      {
        ...ImageAssetSchema,
        label: { type: String },
        position: { type: Number, required: true, default: 0 },
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
      id: { type: String },
      name: { type: String },
      slug: { type: String },
      image: {
        id: { type: String },
        thumbnail: { type: String },
        original: { type: String },
      },
    },

    category: {
      id: { type: String },
      name: MultilingualTextSchema,
      slug: MultilingualTextSchema,
      details: MultilingualTextSchema,
      image: {
        id: { type: String },
        thumbnail: { type: String },
        original: { type: String },
      },
      icon: { type: String },
    },

    collections: [
      {
        id: { type: String },
        name: MultilingualTextSchema,
        slug: MultilingualTextSchema,
      },
    ],

    product_type: {
      id: { type: String },
      name: MultilingualTextSchema,
      slug: MultilingualTextSchema,
      features: [
        {
          key: { type: String },
          label: MultilingualTextSchema,
          value: { type: Schema.Types.Mixed },
          unit: { type: String },
        },
      ],
    },

    // Attributes (Product properties with labels) - dynamically organized by language
    attributes: AttributesSchema,

    // Tags (for marketing, SEO, filtering)
    tags: [
      {
        id: { type: String, required: true },
        name: MultilingualTextSchema,
        slug: { type: String, required: true },
      },
    ],

    // Features (Marketing highlights - dynamically organized by language)
    features: FeaturesSchema,

    // Specifications (Technical data - dynamically organized by language)
    specifications: SpecificationsSchema,

    meta: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],

    parent_sku: { type: String },
    parent_entity_code: { type: String },
    variations_sku: [{ type: String }],
    variations_entity_code: [{ type: String }],

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

    packaging_options: [
      {
        id: { type: String },
        code: { type: String, required: true },
        label: MultilingualTextSchema,
        qty: { type: Number, required: true },
        uom: { type: String, required: true },
        is_default: { type: Boolean, required: true, default: false },
        is_smallest: { type: Boolean, required: true, default: false },
        ean: { type: String },
        position: { type: Number },
      },
    ],

    promotions: [
      {
        promo_code: { type: String },
        is_active: { type: Boolean, required: true, default: true },
        promo_type: {
          type: String,
          enum: ["percentage", "fixed_amount", "amount", "buy_x_get_y", "bundle", "free_shipping"],
        },
        label: MultilingualTextSchema,
        language: { type: String }, // Validated at runtime via middleware
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
      },
    ],

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

export const PIMProductModel =
  mongoose.models.PIMProduct ||
  mongoose.model<IPIMProduct>("PIMProduct", PIMProductSchema);
