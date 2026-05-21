import type { BlogPostStatus } from "@/lib/constants/blog";

/** Resolved scope + presentation for a blog mount (B2B app or a B2C storefront). */
export interface BlogChannelContext {
  channel: string;
  label: string;
  basePath: string;
}

export interface BlogPostListItem {
  post_id: string;
  slug: string;
  channels: string[];
  category_ids: string[];
  tag_ids: string[];
  cover_image?: { url: string; alt_text?: string; cdn_key?: string } | null;
  locale: string;
  title: string;
  excerpt?: string | null;
  status: BlogPostStatus;
  scheduled_at?: string | null;
  published_at?: string | null;
  locales: string[];
  default_locale: string;
  created_at: string;
  updated_at: string;
}

export interface BlogTaxonomyItem {
  category_id?: string;
  tag_id?: string;
  name: string | Record<string, string>;
  slug: string;
  color?: string;
  display_order: number;
  is_active: boolean;
  post_count: number;
}

export interface SalesChannelOption {
  code: string;
  name: string;
}
