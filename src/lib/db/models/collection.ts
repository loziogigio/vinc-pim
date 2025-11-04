import mongoose, { Schema, Document } from "mongoose";

export interface ICollection extends Document {
  collection_id: string;
  wholesaler_id: string;
  name: string;
  slug: string;
  description?: string;

  // Hero/Cover Image
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };

  // SEO Fields
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };

  // Display Order
  display_order: number;

  // Status
  is_active: boolean;

  // Product Count (cached)
  product_count: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    collection_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    wholesaler_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hero_image: {
      url: String,
      alt_text: String,
      cdn_key: String,
    },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
    display_order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    product_count: {
      type: Number,
      default: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index for wholesaler + slug uniqueness
CollectionSchema.index({ wholesaler_id: 1, slug: 1 }, { unique: true });

// Index for sorting
CollectionSchema.index({ wholesaler_id: 1, display_order: 1 });

export const CollectionModel =
  mongoose.models.Collection || mongoose.model<ICollection>("Collection", CollectionSchema);
