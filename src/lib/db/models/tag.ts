import mongoose, { Schema, Document } from "mongoose";

export interface ITag extends Document {
  tag_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
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

// Indexes for efficient querying (no wholesaler_id - database provides isolation)
TagSchema.index({ slug: 1 }, { unique: true });
TagSchema.index({ name: 1 });
TagSchema.index({ is_active: 1 });
TagSchema.index({ display_order: 1 });

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

export { TagSchema };

export const TagModel = mongoose.models.Tag || mongoose.model<ITag>("Tag", TagSchema);
