/**
 * BlogTag Model — editorial tags (separate from PIM Tag).
 * Multilingual name/description via MultiLangString. Collection: blogtags
 */
import { Schema } from "mongoose";
import type { MultiLangString } from "@/lib/types/pim";

export interface IBlogTag {
  _id?: string;
  tag_id: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  color?: string;
  is_active: boolean;
  display_order: number;
  post_count: number;
  created_at: Date;
  updated_at: Date;
}

const BlogTagSchema = new Schema(
  {
    tag_id: { type: String, required: true, unique: true, index: true },
    name: { type: Schema.Types.Mixed, required: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: Schema.Types.Mixed },
    color: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    display_order: { type: Number, default: 0 },
    post_count: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "blogtags",
  }
);

BlogTagSchema.index({ slug: 1 }, { unique: true });

export { BlogTagSchema };
