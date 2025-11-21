import { Schema, model, models, Document } from "mongoose";

export interface IBrand extends Document {
  brand_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
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
    // wholesaler_id removed - database per wholesaler provides isolation
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

// Indexes for efficient querying (no wholesaler_id - database provides isolation)
BrandSchema.index({ slug: 1 }, { unique: true });
BrandSchema.index({ label: 1 });
BrandSchema.index({ is_active: 1 });
BrandSchema.index({ created_at: -1 });

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
