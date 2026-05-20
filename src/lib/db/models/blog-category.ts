/**
 * BlogCategory Model — editorial categories (separate from PIM Category).
 * Multilingual name/description via MultiLangString. Collection: blogcategories
 */
import { Schema } from "mongoose";
import type { MultiLangString } from "@/lib/types/pim";

export interface IBlogCategory {
  _id?: string;
  category_id: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  parent_id?: string;
  channels?: string[];
  seo?: { title?: string; description?: string; keywords?: string[] };
  display_order: number;
  is_active: boolean;
  post_count: number;
  created_at: Date;
  updated_at: Date;
}

const BlogCategorySchema = new Schema(
  {
    category_id: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, required: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: Schema.Types.Mixed },
    parent_id: { type: String, index: true },
    channels: { type: [String], default: undefined },
    seo: { title: String, description: String, keywords: [String] },
    display_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    post_count: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "blogcategories",
  }
);

BlogCategorySchema.index({ slug: 1 }, { unique: true });
BlogCategorySchema.index({ parent_id: 1, display_order: 1 });

export { BlogCategorySchema };
