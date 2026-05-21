/**
 * B2B Sitemap Service
 *
 * Builds the structured sitemap payload (seo-url spec §5.3) that the B2B
 * storefront turns into sitemap.xml. Sibling of `b2c-sitemap.service.ts`.
 *
 * Products are emitted as FLAT slug URLs (`/{lang}/{slug}`); categories as
 * `/{lang}/{categoryRoot}/{path}`; CMS pages as `/{lang}/{cms-slug}`; plus a
 * small set of static routes. Backed by direct Mongo access to `pimproducts`,
 * `categories`, and `b2bpages`. Locale-aware via the Language collection.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  DEFAULT_CATEGORY_ROOT,
  DEFAULT_PORTAL_SLUG,
  type IB2BPortal,
} from "@/lib/types/b2b-portal";

const logPrefix = "[b2b-sitemap]";

// ============================================
// TYPES (§5.3 shape)
// ============================================

export type SitemapEntryType = "product" | "category" | "page" | "static";

export interface SitemapEntry {
  loc: string;
  type: SitemapEntryType;
  changefreq?: string;
  priority?: number;
  lastmod?: string;
}

export interface B2BSitemapData {
  baseUrl: string;
  langs: string[];
  entries: SitemapEntry[];
}

// ============================================
// HELPERS
// ============================================

/** Resolve enabled locales, falling back to the portal's default language. */
async function resolveLocales(
  tenantDb: string,
  fallbackLang: string,
): Promise<string[]> {
  const { Language } = await connectWithModels(tenantDb);
  const enabled = (await Language.find({ isEnabled: true })
    .select("code")
    .lean()) as Array<{ code: string }>;
  if (enabled.length > 0) return enabled.map((l) => l.code);
  return [fallbackLang];
}

/** Per-locale category root segment ("categorie" default, optional override). */
function categoryRootForLocale(
  seoConfig: IB2BPortal["seo_config"],
  locale: string,
): string {
  const root = seoConfig?.category_root;
  if (root && typeof root === "object") {
    const perLocale = root[locale];
    if (typeof perLocale === "string" && perLocale.trim())
      return perLocale.trim();
    if (typeof root.default === "string" && root.default.trim()) {
      return root.default.trim();
    }
  }
  return DEFAULT_CATEGORY_ROOT;
}

// ============================================
// COLLECTORS
// ============================================

async function collectProductEntries(
  tenantDb: string,
  channel: string | undefined,
  locales: string[],
): Promise<SitemapEntry[]> {
  const { PIMProduct } = await connectWithModels(tenantDb);
  const entries: SitemapEntry[] = [];

  const query: Record<string, unknown> = {
    status: "published",
    isCurrent: true,
    not_visible: { $ne: true },
  };
  if (channel) query.channels = channel;

  const cursor = PIMProduct.find(query)
    .select("sku slug updated_at")
    .lean()
    .cursor();

  for await (const product of cursor) {
    const p = product as unknown as {
      sku: string;
      slug?: Record<string, string>;
      updated_at?: Date;
    };
    const lastmod = p.updated_at
      ? new Date(p.updated_at).toISOString()
      : undefined;
    for (const locale of locales) {
      const productSlug = p.slug?.[locale] || p.sku;
      entries.push({
        loc: `/${locale}/${productSlug}`,
        type: "product",
        changefreq: "weekly",
        priority: 0.6,
        lastmod,
      });
    }
  }

  return entries;
}

async function collectCategoryEntries(
  tenantDb: string,
  channel: string | undefined,
  locales: string[],
  seoConfig: IB2BPortal["seo_config"],
): Promise<SitemapEntry[]> {
  const { Category } = await connectWithModels(tenantDb);
  const entries: SitemapEntry[] = [];

  const categories = (await Category.find({ is_active: { $ne: false } })
    .select("slug category_id path updated_at channel_code")
    .lean()) as Array<{
    slug?: string;
    category_id?: string;
    path?: string[];
    updated_at?: Date;
    channel_code?: string;
  }>;

  // Map category_id → slug for hierarchical path resolution.
  const slugById = new Map<string, string>();
  for (const c of categories) {
    if (c.category_id && c.slug) slugById.set(c.category_id, c.slug);
  }

  // The PIM tree has a synthetic root node (empty `path`, slug typically equal
  // to the URL root e.g. "categorie"). Flatten it so children sit directly under
  // the URL root — avoids `/categorie/categorie/...`. Mirrors the existing
  // vinc-b2b sitemap flattening.
  const rootIds = new Set(
    categories
      .filter((c) => c.category_id && (!c.path || c.path.length === 0))
      .map((c) => c.category_id as string),
  );

  for (const cat of categories) {
    if (!cat.slug || !cat.category_id) continue;
    const isRoot = rootIds.has(cat.category_id);
    const ancestorSlugs = (cat.path || [])
      .filter((id) => !rootIds.has(id))
      .map((id) => slugById.get(id) || id);
    const relPath = isRoot ? "" : [...ancestorSlugs, cat.slug].join("/");
    const lastmod = cat.updated_at
      ? new Date(cat.updated_at).toISOString()
      : undefined;

    for (const locale of locales) {
      const root = categoryRootForLocale(seoConfig, locale);
      entries.push({
        loc: relPath ? `/${locale}/${root}/${relPath}` : `/${locale}/${root}`,
        type: "category",
        changefreq: "weekly",
        priority: 0.7,
        lastmod,
      });
    }
  }

  return entries;
}

async function collectPageEntries(
  tenantDb: string,
  portalSlug: string,
  locales: string[],
): Promise<SitemapEntry[]> {
  const { B2BPage } = await connectWithModels(tenantDb);
  const entries: SitemapEntry[] = [];

  const pages = (await B2BPage.find({
    portal_slug: portalSlug,
    status: "active",
  })
    .select("slug updated_at")
    .lean()) as Array<{ slug: string; updated_at?: Date }>;

  for (const page of pages) {
    const lastmod = page.updated_at
      ? new Date(page.updated_at).toISOString()
      : undefined;
    for (const locale of locales) {
      entries.push({
        loc: `/${locale}/${page.slug}`,
        type: "page",
        changefreq: "weekly",
        priority: 0.4,
        lastmod,
      });
    }
  }

  return entries;
}

function collectStaticEntries(locales: string[]): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const locale of locales) {
    entries.push({
      loc: `/${locale}`,
      type: "static",
      changefreq: "daily",
      priority: 1.0,
    });
    entries.push({
      loc: `/${locale}/search`,
      type: "static",
      changefreq: "weekly",
      priority: 0.8,
    });
  }
  return entries;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Build the full §5.3 sitemap payload for a tenant + portal.
 */
export async function buildB2BSitemapData(
  tenantDb: string,
  host: string,
  portalSlug: string = DEFAULT_PORTAL_SLUG,
): Promise<B2BSitemapData> {
  const { B2BPortal } = await connectWithModels(tenantDb);
  const portal = (await B2BPortal.findOne({ slug: portalSlug })
    .select("channel settings seo_config")
    .lean()) as Pick<IB2BPortal, "channel" | "settings" | "seo_config"> | null;

  const fallbackLang = portal?.settings?.default_language || "it";
  const channel = portal?.channel;
  const seoConfig = portal?.seo_config;

  const locales = await resolveLocales(tenantDb, fallbackLang);

  const [products, categories, pages] = await Promise.all([
    collectProductEntries(tenantDb, channel, locales),
    collectCategoryEntries(tenantDb, channel, locales, seoConfig),
    collectPageEntries(tenantDb, portalSlug, locales),
  ]);
  const statics = collectStaticEntries(locales);

  const entries = [...statics, ...products, ...categories, ...pages];

  console.log(
    `${logPrefix} Built sitemap for "${portalSlug}": ${entries.length} entries across ${locales.length} locale(s)`,
  );

  return {
    baseUrl: `https://${host}`,
    langs: locales,
    entries,
  };
}

// Exported for unit testing.
export const __test = {
  categoryRootForLocale,
  collectStaticEntries,
};
