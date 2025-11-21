import mongoose, { Schema, Document } from "mongoose";

export interface IProductTypeFeature {
  feature_id: string; // Reference to TechnicalFeature
  required: boolean; // Override per product type
  display_order: number; // Override per product type
}

export interface IProductType extends Document {
  product_type_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  name: string; // e.g., "Water Meter", "Pump", "Valve"
  slug: string;
  description?: string;

  // Technical Features (references to TechnicalFeature model)
  features: IProductTypeFeature[];

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

const ProductTypeFeatureSchema = new Schema<IProductTypeFeature>(
  {
    feature_id: {
      type: String,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ProductTypeSchema = new Schema<IProductType>(
  {
    product_type_id: {
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
    features: {
      type: [ProductTypeFeatureSchema],
      default: [],
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
ProductTypeSchema.index({ slug: 1 }, { unique: true });

// Index for sorting
ProductTypeSchema.index({ display_order: 1 });

export const ProductTypeModel =
  mongoose.models.ProductType || mongoose.model<IProductType>("ProductType", ProductTypeSchema);
