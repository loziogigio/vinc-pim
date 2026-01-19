import mongoose, { Schema, Document } from "mongoose";

export interface ICollection extends Document {
  collection_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  name: string;
  slug: string;
  locale: string;  // Language code: "it", "en", etc.
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
    // wholesaler_id removed - database per wholesaler provides isolation
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
    locale: {
      type: String,
      required: true,
      default: "it",
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

// Index for slug uniqueness (no wholesaler_id - database provides isolation)
CollectionSchema.index({ slug: 1 }, { unique: true });

// Index for sorting
CollectionSchema.index({ display_order: 1 });

// Export schema for model-registry
export { CollectionSchema };

export const CollectionModel =
  mongoose.models.Collection || mongoose.model<ICollection>("Collection", CollectionSchema);
