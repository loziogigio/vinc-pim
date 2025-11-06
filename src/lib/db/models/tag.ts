import { Schema, model, models, Document } from "mongoose";

export interface ITag extends Document {
  tag_id: string;
  wholesaler_id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

const TagSchema = new Schema<ITag>(
  {
    tag_id: {
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
    color: {
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

TagSchema.index({ wholesaler_id: 1, slug: 1 }, { unique: true });
TagSchema.index({ wholesaler_id: 1, name: 1 });
TagSchema.index({ wholesaler_id: 1, is_active: 1 });
TagSchema.index({ wholesaler_id: 1, display_order: 1 });

TagSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

export const TagModel = models.Tag || model<ITag>("Tag", TagSchema);
