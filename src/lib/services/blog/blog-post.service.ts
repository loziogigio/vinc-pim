// src/lib/services/blog/blog-post.service.ts
/**
 * Blog post registry service — CRUD + list for BlogPost documents.
 * Block content/versioning lives in blog-content.service.ts.
 */
import { nanoid } from "nanoid";
import { connectWithModels } from "@/lib/db/connection";
import { blogSlugify } from "@/lib/constants/blog";
import { getTenantLanguageCodes, getTenantDefaultLanguageCode } from "@/lib/services/tenant-languages";
import type { IBlogPost } from "@/lib/db/models/blog-post";

function httpError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface CreateBlogPostInput {
  title: string;
  slug?: string;
  channels?: string[];
  default_locale?: string;
  excerpt?: string;
  category_ids?: string[];
  tag_ids?: string[];
}

export interface UpdateBlogPostInput {
  slug?: string;
  channels?: string[];
  category_ids?: string[];
  tag_ids?: string[];
  cover_image?: { url: string; alt_text?: string; cdn_key?: string };
  author?: { user_id?: string; name?: string };
  translation?: { locale: string; title?: string; excerpt?: string; scheduled_at?: string | null };
}

export interface ListBlogPostsParams {
  channel?: string;
  locale?: string;
  status?: string;
  category?: string;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

async function assertChannelsValid(tenantDb: string, channels?: string[]): Promise<void> {
  if (!channels || channels.length === 0) return;
  const { SalesChannel } = await connectWithModels(tenantDb);
  const found = await SalesChannel.find({ code: { $in: channels } }).select("code").lean();
  const valid = new Set([...(found as any[]).map((c) => c.code), "default"]);
  const invalid = channels.filter((c) => !valid.has(c));
  if (invalid.length) throw httpError(`Unknown channel(s): ${invalid.join(", ")}`, 400);
}

export async function assertSlugAvailable(
  tenantDb: string,
  slug: string,
  exceptPostId?: string,
): Promise<void> {
  const { BlogPost } = await connectWithModels(tenantDb);
  const existing: any = await BlogPost.findOne({ slug }).lean();
  if (existing && existing.post_id !== exceptPostId) {
    throw httpError("A post with this slug already exists", 409);
  }
}

export async function createBlogPost(tenantDb: string, input: CreateBlogPostInput): Promise<IBlogPost> {
  const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
  const [allowedCodes, defaultLocale] = await Promise.all([
    getTenantLanguageCodes(tenantDb),
    getTenantDefaultLanguageCode(tenantDb),
  ]);
  const locale = input.default_locale && allowedCodes.includes(input.default_locale)
    ? input.default_locale
    : defaultLocale;
  const slug = blogSlugify(input.slug || input.title);
  if (!slug) throw httpError("A valid slug or title is required", 400);
  await assertSlugAvailable(tenantDb, slug);
  await assertChannelsValid(tenantDb, input.channels);

  const postId = `bp_${nanoid(10)}`;
  const now = new Date().toISOString();
  const post = await BlogPost.create({
    post_id: postId,
    slug,
    channels: input.channels?.length ? input.channels : ["default"],
    category_ids: input.category_ids || [],
    tag_ids: input.tag_ids || [],
    default_locale: locale,
    translations: [{ locale, title: input.title, excerpt: input.excerpt, status: "draft", current_version: 1 }],
  });
  await BlogPostVersion.create({
    post_id: postId, locale, version: 1, blocks: [], seo: {}, status: "draft",
    label: "Version 1", created_at: now, created_by: "b2b-admin", comment: "Version 1", is_current: true,
  });
  return post.toObject();
}

export async function getBlogPost(tenantDb: string, postId: string): Promise<IBlogPost | null> {
  const { BlogPost } = await connectWithModels(tenantDb);
  return BlogPost.findOne({ post_id: postId }).lean();
}

function projectListItem(post: any, locale?: string) {
  const tr =
    (locale && post.translations.find((t: any) => t.locale === locale)) ||
    post.translations.find((t: any) => t.locale === post.default_locale) ||
    post.translations[0];
  return {
    post_id: post.post_id,
    slug: post.slug,
    channels: post.channels,
    category_ids: post.category_ids,
    tag_ids: post.tag_ids,
    cover_image: post.cover_image ?? null,
    locale: tr?.locale ?? post.default_locale,
    title: tr?.title ?? "",
    excerpt: tr?.excerpt ?? null,
    status: tr?.status ?? "draft",
    scheduled_at: tr?.scheduled_at ?? null,
    published_at: tr?.published_at ?? null,
    locales: post.translations.map((t: any) => t.locale),
    default_locale: post.default_locale,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

export async function listBlogPosts(tenantDb: string, params: ListBlogPostsParams) {
  const { BlogPost } = await connectWithModels(tenantDb);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));

  const query: Record<string, unknown> = {};
  if (params.channel) query.channels = params.channel;
  if (params.category) query.category_ids = params.category;
  if (params.tag) query.tag_ids = params.tag;
  if (params.status) query["translations.status"] = params.status;
  if (params.q) {
    query.$or = [
      { slug: { $regex: params.q, $options: "i" } },
      { "translations.title": { $regex: params.q, $options: "i" } },
    ];
  }

  const total = await BlogPost.countDocuments(query);
  const docs: any[] = await BlogPost.find(query)
    .sort({ updated_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    items: docs.map((d) => projectListItem(d, params.locale)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateBlogPost(
  tenantDb: string,
  postId: string,
  patch: UpdateBlogPostInput,
): Promise<IBlogPost> {
  const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
  const post: any = await BlogPost.findOne({ post_id: postId });
  if (!post) throw httpError("Post not found", 404);

  if (patch.slug !== undefined) {
    const slug = blogSlugify(patch.slug);
    if (!slug) throw httpError("Invalid slug", 400);
    if (slug !== post.slug) {
      await assertSlugAvailable(tenantDb, slug, postId);
      post.slug = slug;
    }
  }
  if (patch.channels !== undefined) {
    await assertChannelsValid(tenantDb, patch.channels);
    post.channels = patch.channels;
  }
  if (patch.category_ids !== undefined) post.category_ids = patch.category_ids;
  if (patch.tag_ids !== undefined) post.tag_ids = patch.tag_ids;
  if (patch.cover_image !== undefined) post.cover_image = patch.cover_image;
  if (patch.author !== undefined) post.author = patch.author;

  if (patch.translation) {
    const { locale, title, excerpt, scheduled_at } = patch.translation;
    const allowedCodes = await getTenantLanguageCodes(tenantDb);
    if (!allowedCodes.includes(locale)) throw httpError("Invalid locale", 400);
    const tr = post.translations.find((t: any) => t.locale === locale);
    if (!tr) {
      post.translations.push({ locale, title: title || "", excerpt, status: "draft", current_version: 1 });
      const now = new Date().toISOString();
      await BlogPostVersion.create({
        post_id: postId, locale, version: 1, blocks: [], seo: {}, status: "draft",
        label: "Version 1", created_at: now, created_by: "b2b-admin", comment: "Version 1", is_current: true,
      });
    } else {
      if (title !== undefined) tr.title = title;
      if (excerpt !== undefined) tr.excerpt = excerpt;
      if (scheduled_at !== undefined) tr.scheduled_at = scheduled_at ? new Date(scheduled_at) : undefined;
    }
  }

  await post.save();
  return post.toObject();
}

export async function deleteBlogPost(tenantDb: string, postId: string): Promise<void> {
  const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
  const post = await BlogPost.findOne({ post_id: postId });
  if (!post) throw httpError("Post not found", 404);
  await BlogPostVersion.deleteMany({ post_id: postId });
  await BlogPost.deleteOne({ post_id: postId });
}
