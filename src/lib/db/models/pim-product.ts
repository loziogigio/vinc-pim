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

export interface IPIMProduct extends Document {
  // ============================================
  // SECTION 1: PIM METADATA
  // ============================================

  // Identity & Ownership
  wholesaler_id: string;
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
  name: string;
  slug: string;
  description?: string;

  // Images (Attachment type)
  image: {
    id: string;
    thumbnail: string;
    original: string;
  };
  gallery?: {
    id: string;
    thumbnail: string;
    original: string;
  }[];

  // PIM Image Management (for manual uploads)
  images?: {
    url: string;
    cdn_key: string;
    position: number;
    uploaded_at: Date;
    uploaded_by: string;
    file_name?: string;
    file_type?: string;
    size_bytes?: number;
  }[];

  // PIM Media Management (documents, videos, 3D models)
  media?: {
    type: "document" | "video" | "3d-model";
    file_type: string;
    url: string;
    cdn_key: string;
    label?: string;
    size_bytes: number;
    uploaded_at: Date;
    uploaded_by: string;
  }[];

  // Inventory
  quantity: number;
  sold: number;
  unit: string;

  // Brand (Brand type)
  brand?: {
    id: string;
    name: string;
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
    name: string;
    slug: string;
    details?: string;
    image?: {
      id: string;
      thumbnail: string;
      original: string;
    };
    icon?: string;
  };

  // Tags (Tag[] type)
  tag?: {
    id: string;
    name: string;
    slug: string;
  }[];

  // Features
  features?: {
    label: string;
    value: string;
    unit?: string;
  }[];

  // Documents
  docs?: {
    id: number;
    url: string;
    area?: string;
    filename?: string;
    ext?: string;
  }[];

  // Metadata
  meta?: {
    key: string;
    value: string;
  }[];

  // Variations
  id_parent?: string;
  parent_sku?: string;
  variations?: string[]; // Array of child entity_codes

  // Additional Product Fields
  product_model?: string;
  short_description?: string;
  long_description?: string;
  product_status?: string;
  product_status_description?: string;
  stock_status?: "in_stock" | "out_of_stock" | "pre_order";

  // ERP Specific
  packaging_options?: {
    packaging_uom: string;
    packaging_qty: number;
    ean?: string;
  }[];

  // SEO
  meta_title?: string;
  meta_description?: string;

  // ============================================
  // SECTION 3: TIMESTAMPS
  // ============================================
  created_at: Date;
  updated_at: Date;
}

const PIMProductSchema = new Schema<IPIMProduct>(
  {
    // ============================================
    // SECTION 1: PIM METADATA
    // ============================================

    wholesaler_id: { type: String, required: true, index: true },
    entity_code: { type: String, required: true, index: true },

    version: { type: Number, required: true, default: 1 },
    isCurrent: { type: Boolean, required: true, default: true },
    isCurrentPublished: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    published_at: { type: Date },

    source: {
      source_id: { type: String, required: true, index: true },
      source_name: { type: String, required: true },
      batch_id: { type: String, index: true },
      imported_at: { type: Date, required: true },
    },

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
    name: { type: String, required: true },
    slug: { type: String, index: true },
    description: { type: String },

    image: {
      id: { type: String, required: true },
      thumbnail: { type: String, required: true },
      original: { type: String, required: true },
    },
    gallery: [
      {
        id: { type: String, required: true },
        thumbnail: { type: String, required: true },
        original: { type: String, required: true },
      },
    ],

    // PIM Image Management (for manual uploads)
    images: [
      {
        url: { type: String, required: true },
        cdn_key: { type: String, required: true },
        position: { type: Number, required: true },
        uploaded_at: { type: Date, required: true },
        uploaded_by: { type: String, required: true },
        file_name: { type: String },
        file_type: { type: String },
        size_bytes: { type: Number },
      },
    ],

    // PIM Media Management (documents, videos, 3D models)
    media: [
      {
        type: { type: String, enum: ["document", "video", "3d-model"], required: true },
        file_type: { type: String, required: true },
        url: { type: String, required: true },
        cdn_key: { type: String, required: true },
        label: { type: String },
        size_bytes: { type: Number, required: true },
        uploaded_at: { type: Date, required: true },
        uploaded_by: { type: String, required: true },
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
      name: { type: String },
      slug: { type: String },
      details: { type: String },
      image: {
        id: { type: String },
        thumbnail: { type: String },
        original: { type: String },
      },
      icon: { type: String },
    },

    tag: [
      {
        id: { type: String },
        name: { type: String },
        slug: { type: String },
      },
    ],

    features: [
      {
        label: { type: String },
        value: { type: String },
        unit: { type: String },
      },
    ],

    docs: [
      {
        id: { type: Number, required: true },
        url: { type: String, required: true },
        area: { type: String },
        filename: { type: String },
        ext: { type: String },
      },
    ],

    meta: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],

    id_parent: { type: String },
    parent_sku: { type: String },
    variations: [{ type: String }],

    product_model: { type: String },
    short_description: { type: String },
    long_description: { type: String },
    product_status: { type: String },
    product_status_description: { type: String },
    stock_status: {
      type: String,
      enum: ["in_stock", "out_of_stock", "pre_order"],
    },

    packaging_options: [
      {
        packaging_uom: { type: String, required: true },
        packaging_qty: { type: Number, required: true },
        ean: { type: String },
      },
    ],

    meta_title: { type: String },
    meta_description: { type: String },

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

// Compound indexes for performance
PIMProductSchema.index({ entity_code: 1, version: 1 });
PIMProductSchema.index({ entity_code: 1, isCurrent: 1 });
PIMProductSchema.index({ wholesaler_id: 1, status: 1, completeness_score: -1 });
PIMProductSchema.index({ wholesaler_id: 1, "analytics.priority_score": -1 });
PIMProductSchema.index({ "source.source_id": 1, status: 1 });

export const PIMProductModel =
  mongoose.models.PIMProduct ||
  mongoose.model<IPIMProduct>("PIMProduct", PIMProductSchema);
