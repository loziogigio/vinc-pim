// src/lib/services/blog/home-news.service.ts
/**
 * Home-launcher "Novità & aggiornamenti" feed.
 *
 * All launcher news comes from VendereInCloud's own tenant blog
 * (`vendereincloud-it`) and is shown identically on every tenant's home page —
 * these are platform announcements (releases, guides, notices), not the
 * viewing tenant's own posts.
 *
 * Every CS tenant lives on the same MongoDB, so the platform tenant's blog is
 * read directly cross-tenant via `listBlogPosts` — no HTTP / API keys needed.
 * The read is guarded and degrades to an empty list (→ placeholder) on error.
 */
import type { MultiLangString } from "@/lib/types/pim";
import type { PageBlock } from "@/lib/types/blocks";
import { connectWithModels } from "@/lib/db/connection";
import { getTenantDefaultLanguageCode } from "@/lib/services/tenant-languages";
import { listBlogPosts } from "./blog-post.service";
import { listBlogCategories } from "./blog-taxonomy.service";
import { getBlogContent } from "./blog-content.service";
import { listPages, getPageBySlug } from "@/lib/services/b2b-page.service";
import { getPublishedB2BPageTemplate } from "@/lib/db/b2b-page-templates";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";
import {
  type HomeNewsItem,
  type HomeNewsPageLink,
  HOME_NEWS_DEFAULT_LIMIT,
  formatNewsDate,
  mergeNews,
  pickLang,
} from "./home-news";

/** Tenant DB that owns the launcher news (VendereInCloud's own tenant). */
const PLATFORM_TENANT_DB = process.env.VINC_PLATFORM_TENANT_DB || "vinc-vendereincloud-it";
/** Optional sales-channel filter within the platform tenant (default: all published posts). */
const PLATFORM_CHANNEL = process.env.VINC_PLATFORM_BLOG_CHANNEL || undefined;
/** Optional public site that renders these posts, for "read more" links (e.g. https://www.vendereincloud.it). */
const PLATFORM_PUBLIC_URL = (process.env.VINC_BLOG_PUBLIC_URL || "").replace(/\/+$/, "");

async function getPlatformNews(tenant: string, locale: string, limit: number): Promise<HomeNewsItem[]> {
  const [list, categories] = await Promise.all([
    listBlogPosts(PLATFORM_TENANT_DB, {
      status: "published",
      locale,
      limit,
      ...(PLATFORM_CHANNEL ? { channel: PLATFORM_CHANNEL } : {}),
    }),
    listBlogCategories(PLATFORM_TENANT_DB, { includeInactive: false }),
  ]);

  const categoryName = new Map<string, MultiLangString>(
    (categories as Array<{ category_id: string; name: MultiLangString }>).map((c) => [c.category_id, c.name]),
  );

  return list.items
    .filter((p) => p.status === "published" && p.published_at)
    .map((p) => ({
      id: `vinc:${p.post_id}`,
      source: "central" as const,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category_ids?.[0] ? pickLang(categoryName.get(p.category_ids[0]), locale) || null : null,
      coverUrl: p.cover_image?.url ?? null,
      publishedAt: p.published_at,
      dateLabel: formatNewsDate(p.published_at, locale),
      // Public article when a public site is configured; otherwise the in-app reader.
      href: PLATFORM_PUBLIC_URL
        ? `${PLATFORM_PUBLIC_URL}/${locale}/blog/${p.slug}`
        : `/${tenant}/b2b/news/${p.slug}`,
      external: Boolean(PLATFORM_PUBLIC_URL),
    }));
}

/**
 * Build the launcher news feed for the viewing `tenant`.
 * The content source is fixed (the platform tenant); `tenant` only selects the
 * display language. Never throws — degrades to an empty list.
 */
export async function getHomeNews(
  tenant: string,
  opts?: { limit?: number; locale?: string },
): Promise<HomeNewsItem[]> {
  const limit = opts?.limit ?? HOME_NEWS_DEFAULT_LIMIT;

  // Resolve the viewer tenant's default language so posts render in their locale
  // (listBlogPosts falls back to the post's default translation when missing).
  let resolved = opts?.locale;
  if (!resolved) {
    try {
      resolved = await getTenantDefaultLanguageCode(`vinc-${tenant}`);
    } catch {
      resolved = undefined;
    }
  }
  const locale = resolved || "it";

  const platform = await getPlatformNews(tenant, locale, limit).catch(() => [] as HomeNewsItem[]);
  return mergeNews(platform, [], limit);
}

/** A single platform post rendered in the in-app reader. */
export interface HomeNewsArticle {
  slug: string;
  title: string;
  category: string | null;
  coverUrl: string | null;
  dateLabel: string;
  blocks: PageBlock[];
  seo: { title?: string; description?: string } | null;
}

/**
 * Fetch one platform post (by slug) with its published blocks, for the in-app reader.
 * Reads cross-tenant from the platform tenant. Returns null when missing or unpublished.
 */
export async function getPlatformPost(
  slug: string,
  opts?: { locale?: string; viewerTenant?: string },
): Promise<HomeNewsArticle | null> {
  const { BlogPost } = await connectWithModels(PLATFORM_TENANT_DB);
  const post: any = await BlogPost.findOne({ slug }).lean();
  if (!post) return null;

  let locale = opts?.locale;
  if (!locale && opts?.viewerTenant) {
    try {
      locale = await getTenantDefaultLanguageCode(`vinc-${opts.viewerTenant}`);
    } catch {
      /* ignore — fall back below */
    }
  }
  locale = locale || post.default_locale || "it";

  const content = await getBlogContent(PLATFORM_TENANT_DB, post.post_id, locale);
  const version = content.versions.find((v) => (v as { version?: number }).version === content.currentPublishedVersion) ?? null;
  if (!version) return null; // nothing published in this locale

  const tr =
    post.translations?.find((t: any) => t.locale === locale) ??
    post.translations?.find((t: any) => t.locale === post.default_locale) ??
    post.translations?.[0];

  const categories = await listBlogCategories(PLATFORM_TENANT_DB, { includeInactive: false });
  const categoryName = new Map<string, MultiLangString>(
    (categories as Array<{ category_id: string; name: MultiLangString }>).map((c) => [c.category_id, c.name]),
  );

  const blocks = (((version as { blocks?: PageBlock[] }).blocks as PageBlock[]) ?? []).slice();
  blocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    slug: post.slug,
    title: tr?.title ?? "",
    category: post.category_ids?.[0] ? pickLang(categoryName.get(post.category_ids[0]), locale) || null : null,
    coverUrl: post.cover_image?.url ?? null,
    dateLabel: formatNewsDate(tr?.published_at ?? null, locale),
    blocks,
    seo: ((version as { seo?: { title?: string; description?: string } }).seo) ?? null,
  };
}

async function resolveViewerLocale(opts?: { locale?: string; viewerTenant?: string }): Promise<string> {
  if (opts?.locale) return opts.locale;
  if (opts?.viewerTenant) {
    try {
      return await getTenantDefaultLanguageCode(`vinc-${opts.viewerTenant}`);
    } catch {
      /* ignore — fall back below */
    }
  }
  return "it";
}

/** Published platform static pages (CMS pages from the platform tenant), shown alongside the news. */
export async function listPlatformPages(
  opts?: { locale?: string; viewerTenant?: string },
): Promise<HomeNewsPageLink[]> {
  const locale = await resolveViewerLocale(opts);
  try {
    const { items } = await listPages(PLATFORM_TENANT_DB, DEFAULT_PORTAL_SLUG, {
      lang: locale,
      status: "active",
      limit: 50,
    });
    return items
      .filter((p) => p.show_in_nav && p.template_status === "published")
      .map((p) => ({ slug: p.slug, title: p.title }));
  } catch {
    return [];
  }
}

/**
 * Fetch one platform CMS static page (by slug) with its published blocks, for the in-app reader.
 * A separate content type from the blog/news (same platform source + reader). Null when missing/unpublished.
 */
export async function getPlatformPage(slug: string): Promise<HomeNewsArticle | null> {
  const page = await getPageBySlug(PLATFORM_TENANT_DB, DEFAULT_PORTAL_SLUG, slug);
  if (!page || page.status !== "active") return null;

  const tpl = await getPublishedB2BPageTemplate(DEFAULT_PORTAL_SLUG, slug, PLATFORM_TENANT_DB);
  if (!tpl) return null;

  const blocks = ((tpl.blocks as PageBlock[]) ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    slug: page.slug,
    title: page.title,
    category: null,
    coverUrl: null,
    dateLabel: "", // pages are evergreen — no date shown
    blocks,
    seo: (tpl.seo as { title?: string; description?: string }) ?? null,
  };
}
