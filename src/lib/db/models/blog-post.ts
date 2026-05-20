/**
 * BlogPost Model — registry + lightweight per-locale meta.
 *
 * Block content + version history live in BlogPostVersion (blogpostversions),
 * keyed by (post_id, locale). This document holds the language-independent
 * registry fields plus a denormalized translations[] summary for fast listing.
 *
 * Collection: blogposts
 */
import { Schema } from "mongoose";
import { BLOG_POST_STATUSES } from "@/lib/constants/blog";
import type { BlogPostStatus } from "@/lib/constants/blog";

export interface IBlogPostTranslation {
  locale: string;
  title: string;
  excerpt?: string;
  status: BlogPostStatus;
  scheduled_at?: Date;
  published_at?: Date;
  current_version: number;
  published_version?: number;
}

export interface IBlogPost {
  _id?: string;
  post_id: string;
  slug: string;
  channels: string[];
  category_ids: string[];
  tag_ids: string[];
  cover_image?: { url: string; alt_text?: string; cdn_key?: string };
  author?: { user_id?: string; name?: string };
  default_locale: string;
  translations: IBlogPostTranslation[];
  created_at: Date;
  updated_at: Date;
}

const BlogPostTranslationSchema = new Schema<IBlogPostTranslation>(
  {
    locale: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, trim: true },
    status: { type: String, enum: BLOG_POST_STATUSES, default: "draft" },
    scheduled_at: { type: Date },
    published_at: { type: Date },
    current_version: { type: Number, default: 1 },
    published_version: { type: Number },
  },
  { _id: false }
);

const BlogPostSchema = new Schema(
  {
    post_id: { type: String, required: true, unique: true, index: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"],
    },
    channels: { type: [String], default: [] },
    category_ids: { type: [String], default: [] },
    tag_ids: { type: [String], default: [] },
    cover_image: { url: String, alt_text: String, cdn_key: String },
    author: { user_id: String, name: String },
    default_locale: { type: String, required: true },
    translations: { type: [BlogPostTranslationSchema], default: [] },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "blogposts",
  }
);

BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ channels: 1 });
BlogPostSchema.index({ "translations.status": 1 });
BlogPostSchema.index({ "translations.scheduled_at": 1 });

export { BlogPostSchema };
