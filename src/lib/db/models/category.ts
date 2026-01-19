import mongoose, { Schema, Document } from "mongoose";

export interface ICategory extends Document {
  category_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  name: string;
  slug: string;
  description?: string;
  parent_id?: string; // For hierarchical structure
  level: number; // 0 = root, 1 = child of root, etc.
  path: string[]; // Array of parent IDs for quick hierarchy queries

  // Hero/Background Image
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

const CategorySchema = new Schema<ICategory>(
  {
    category_id: {
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
    description: {
      type: String,
      trim: true,
    },
    parent_id: {
      type: String,
      index: true,
    },
    level: {
      type: Number,
      default: 0,
      index: true,
    },
    path: {
      type: [String],
      default: [],
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
CategorySchema.index({ slug: 1 }, { unique: true });

// Index for hierarchy queries
CategorySchema.index({ parent_id: 1, display_order: 1 });

// Export schema for model-registry
export { CategorySchema };

export const CategoryModel =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);
