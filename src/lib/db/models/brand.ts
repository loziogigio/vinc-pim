import { Schema, model, models, Document } from "mongoose";

export interface IBrand extends Document {
  brand_id: string;
  wholesaler_id: string;
  label: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    brand_id: {
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
    label: {
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
    logo_url: {
      type: String,
      trim: true,
    },
    website_url: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    product_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Compound index for efficient querying
BrandSchema.index({ wholesaler_id: 1, slug: 1 }, { unique: true });
BrandSchema.index({ wholesaler_id: 1, label: 1 });
BrandSchema.index({ wholesaler_id: 1, is_active: 1 });
BrandSchema.index({ wholesaler_id: 1, created_at: -1 });

// Pre-save hook to generate slug from label if not provided
BrandSchema.pre("save", function (next) {
  if (!this.slug && this.label) {
    this.slug = this.label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

export const BrandModel =
  models.Brand || model<IBrand>("Brand", BrandSchema);
