/**
 * BlogPostVersion Model — block content + version history.
 *
 * One set of flat per-version documents per (post_id, locale), mirroring the
 * b2b-home-template versioning pattern: is_current marks the working/draft
 * version, is_current_published marks the live version.
 *
 * Collection: blogpostversions
 */
import { Schema } from "mongoose";

export interface IBlogPostVersion {
  _id?: string;
  post_id: string;
  locale: string;
  version: number;
  blocks: unknown[];
  seo?: unknown;
  status: "draft" | "published";
  is_current: boolean;
  is_current_published: boolean;
  label?: string;
  comment?: string;
  created_at: string;
  created_by?: string;
  published_at?: string;
}

const BlogPostVersionSchema = new Schema(
  {
    post_id: { type: String, required: true, index: true },
    locale: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    blocks: { type: Schema.Types.Mixed, required: true },
    seo: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    is_current: { type: Boolean, default: false, index: true },
    is_current_published: { type: Boolean, default: false, index: true },
    label: { type: String },
    comment: { type: String },
    created_at: { type: String, required: true },
    created_by: { type: String },
    published_at: { type: String },
  },
  { timestamps: false, collection: "blogpostversions" }
);

BlogPostVersionSchema.index({ post_id: 1, locale: 1, version: 1 }, { unique: true });
BlogPostVersionSchema.index({ post_id: 1, locale: 1, is_current: 1 });
BlogPostVersionSchema.index({ post_id: 1, locale: 1, is_current_published: 1 });

export { BlogPostVersionSchema };
