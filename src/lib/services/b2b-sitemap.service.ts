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
  DEFAULT_SEO_ROBOTS_DISALLOW,
  DEFAULT_PORTAL_SLUG,
  type IB2BPortal,
} from "@/lib/types/b2b-portal";
import type {
  ChangeFreq,
  IB2BSitemap,
  ISitemapStats,
  ISitemapUrl,
  ISitemapValidation,
  SitemapUrlType,
} from "@/lib/db/models/b2b-sitemap";
import {
  canonicalHostForPortal,
  normalizeCategoryRootSegment,
} from "@/lib/services/b2b-seo-config.service";

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
    const perLocale = normalizeCategoryRootSegment(root[locale]);
    if (perLocale) return perLocale;
    const fallback = normalizeCategoryRootSegment(root.default);
    if (fallback) return fallback;
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
  if (channel) {
    query.$or = [
      { channels: channel },
      { "channel_categories.channel_code": channel },
    ];
  }

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
        // A SKU is the last-resort slug. Encode it so legacy SKUs containing
        // spaces or slashes still occupy one flat route segment.
        loc: `/${locale}/${encodeURIComponent(productSlug)}`,
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

  const query: Record<string, unknown> = { is_active: { $ne: false } };

  // A tenant can own several category trees. Only include the tree attached
  // to this portal's sales channel (root + descendants), matching the public
  // categories API used by vinc-b2b at runtime.
  if (channel) {
    const channelRoots = (await Category.find({
      channel_code: channel,
      $or: [{ parent_id: null }, { parent_id: { $exists: false } }],
    })
      .select("category_id")
      .lean()) as Array<{ category_id?: string }>;
    const channelRootIds = channelRoots
      .map((root) => root.category_id)
      .filter((id): id is string => Boolean(id));

    if (channelRootIds.length === 0) return [];
    query.$or = [
      { category_id: { $in: channelRootIds } },
      { path: { $in: channelRootIds } },
    ];
  }

  const categories = (await Category.find(query)
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
      .map((id) => encodeURIComponent(slugById.get(id) || id));
    const relPath = isRoot
      ? ""
      : [...ancestorSlugs, encodeURIComponent(cat.slug)].join("/");
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
  const { B2BPage, HomeTemplate } = await connectWithModels(tenantDb);
  const entries: SitemapEntry[] = [];

  const pages = (await B2BPage.find({
    portal_slug: portalSlug,
    status: "active",
  })
    .select("slug lang updated_at")
    .lean()) as Array<{ slug: string; lang?: string; updated_at?: Date }>;

  const templateIds = pages.map(
    (page) => `b2b-${portalSlug}-page-${page.slug}`,
  );
  const publishedTemplates = (await HomeTemplate.find({
    templateId: { $in: templateIds },
    status: "published",
  })
    .select("templateId")
    .lean()) as Array<{ templateId: string }>;
  const publishedIds = new Set(
    publishedTemplates.map((template) => template.templateId),
  );

  for (const page of pages) {
    if (!publishedIds.has(`b2b-${portalSlug}-page-${page.slug}`)) continue;
    const lastmod = page.updated_at
      ? new Date(page.updated_at).toISOString()
      : undefined;
    // Current pages belong to one language. Keep the fallback for legacy rows
    // created before `lang` became required so old content remains discoverable.
    const pageLocales = page.lang ? [page.lang] : locales;
    for (const locale of pageLocales) {
      if (!locales.includes(locale)) continue;
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
    .select("channel settings seo_config status domains")
    .lean()) as Pick<
    IB2BPortal,
    "channel" | "settings" | "seo_config" | "status" | "domains"
  > | null;

  if (!portal) throw new Error(`Portal "${portalSlug}" not found`);
  const canonicalHost = canonicalHostForPortal(portal.domains, host);
  if (portal.status !== "active") {
    return { baseUrl: `https://${canonicalHost}`, langs: [], entries: [] };
  }

  const fallbackLang = portal.settings?.default_language || "it";
  const channel = portal.channel;
  const seoConfig = portal.seo_config;

  const locales = await resolveLocales(tenantDb, fallbackLang);

  const [products, categories, pages] = await Promise.all([
    collectProductEntries(tenantDb, channel, locales),
    collectCategoryEntries(tenantDb, channel, locales, seoConfig),
    collectPageEntries(tenantDb, portalSlug, locales),
  ]);
  const statics = collectStaticEntries(locales);

  // Keep one entry per canonical URL. Route precedence mirrors the storefront:
  // built-ins and category routes win; CMS pages win flat-slug collisions with
  // products (the `[slug]` page performs that same CMS-first disambiguation).
  const rank: Record<SitemapEntryType, number> = {
    product: 1,
    page: 2,
    category: 3,
    static: 4,
  };
  const byLocation = new Map<string, SitemapEntry>();
  for (const entry of [...products, ...pages, ...categories, ...statics]) {
    const current = byLocation.get(entry.loc);
    if (!current || rank[entry.type] > rank[current.type]) {
      byLocation.set(entry.loc, entry);
    }
  }
  const entries = [...byLocation.values()];

  console.log(
    `${logPrefix} Built sitemap for "${portalSlug}": ${entries.length} entries across ${locales.length} locale(s)`,
  );

  return {
    baseUrl: `https://${canonicalHost}`,
    langs: locales,
    entries,
  };
}

// ============================================
// ADMIN GENERATION / VALIDATION
// ============================================

export interface B2BSitemapGenerationResult {
  stats: ISitemapStats;
  validation: ISitemapValidation;
  url_count: number;
}

function storedType(entry: SitemapEntry): SitemapUrlType {
  if (entry.type !== "static") return entry.type;
  // Locale roots are homepages; other built-in routes (currently /search)
  // are browsable pages in the admin sitemap viewer.
  return /^\/[a-z]{2}(?:-[a-z]{2})?\/?$/i.test(entry.loc)
    ? "homepage"
    : "page";
}

function toStoredUrls(data: B2BSitemapData): ISitemapUrl[] {
  return data.entries.map((entry) => ({
    path: entry.loc,
    type: storedType(entry),
    ...(entry.lastmod ? { lastmod: new Date(entry.lastmod) } : {}),
    changefreq: (entry.changefreq || "weekly") as ChangeFreq,
    priority: entry.priority ?? 0.5,
  }));
}

function validatePortalSitemap(
  portal: IB2BPortal,
  stats: ISitemapStats,
): ISitemapValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const domains = portal.domains || [];
  const hasPrimary = domains.some(
    (domain) => typeof domain === "object" && domain.is_primary,
  );

  if (domains.length === 0) {
    errors.push("No domains configured for this portal");
  } else if (!hasPrimary) {
    errors.push("No primary domain configured — sitemap URLs need a base domain");
  }
  if (portal.status !== "active") {
    errors.push("Portal is inactive — search engines should not index it");
  }
  if (portal.seo_config?.robots?.noindex && stats.total_urls > 0) {
    warnings.push(
      "Portal robots are set to noindex while the sitemap contains URLs",
    );
  }
  if (stats.product_urls === 0) {
    warnings.push("No published products found in this portal channel");
  }
  // One built-in `/search` page is stored per locale; anything beyond that is
  // a published CMS page.
  if (stats.page_urls <= stats.locales.length) {
    warnings.push("No active CMS pages found for this portal");
  }
  if (stats.total_urls > 50_000) {
    warnings.push(
      `Sitemap has ${stats.total_urls} URLs — split it into files of at most 50,000 URLs`,
    );
  }

  return { warnings, errors, last_validated_at: new Date() };
}

/** Generate the same authoritative URL set exposed to vinc-b2b and persist it
 * for the Commerce Suite admin browser/stats UI. */
export async function generateB2BSitemap(
  tenantDb: string,
  portalSlug: string = DEFAULT_PORTAL_SLUG,
): Promise<B2BSitemapGenerationResult> {
  const startedAt = Date.now();
  const { B2BPortal, B2BSitemap } = await connectWithModels(tenantDb);
  const portal = (await B2BPortal.findOne({ slug: portalSlug }).lean()) as
    | IB2BPortal
    | null;
  if (!portal) throw new Error(`Portal "${portalSlug}" not found`);

  const primaryDomain = portal.domains?.find(
    (domain) => typeof domain === "object" && domain.is_primary,
  );
  const firstDomain = portal.domains?.[0];
  const rawDomain =
    (typeof primaryDomain === "object" ? primaryDomain.domain : undefined) ||
    (typeof firstDomain === "string" ? firstDomain : firstDomain?.domain) ||
    "localhost";
  const host = rawDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const data = await buildB2BSitemapData(tenantDb, host, portalSlug);
  const urls = toStoredUrls(data);
  const stats: ISitemapStats = {
    total_urls: urls.length,
    homepage_urls: urls.filter((url) => url.type === "homepage").length,
    page_urls: urls.filter((url) => url.type === "page").length,
    product_urls: urls.filter((url) => url.type === "product").length,
    category_urls: urls.filter((url) => url.type === "category").length,
    locales: data.langs,
    last_generated_at: new Date(),
    generation_duration_ms: Date.now() - startedAt,
  };
  const validation = validatePortalSitemap(portal, stats);

  await B2BSitemap.findOneAndUpdate(
    { portal_slug: portalSlug },
    {
      $set: { urls, stats, validation },
      $setOnInsert: {
        portal_slug: portalSlug,
        robots_config: {
          custom_rules: "",
          disallow: [...DEFAULT_SEO_ROBOTS_DISALLOW],
        },
      },
    },
    { upsert: true, new: true },
  );

  return { stats, validation, url_count: urls.length };
}

/** Re-run readiness validation against the currently persisted sitemap. */
export async function validateB2BSitemap(
  tenantDb: string,
  portalSlug: string = DEFAULT_PORTAL_SLUG,
): Promise<ISitemapValidation> {
  const { B2BPortal, B2BSitemap } = await connectWithModels(tenantDb);
  const portal = (await B2BPortal.findOne({ slug: portalSlug }).lean()) as
    | IB2BPortal
    | null;
  if (!portal) throw new Error(`Portal "${portalSlug}" not found`);

  const sitemap = (await B2BSitemap.findOne({ portal_slug: portalSlug }).lean()) as
    | IB2BSitemap
    | null;
  const stats: ISitemapStats = sitemap?.stats || {
    total_urls: 0,
    homepage_urls: 0,
    page_urls: 0,
    product_urls: 0,
    category_urls: 0,
    locales: [],
    last_generated_at: new Date(),
    generation_duration_ms: 0,
  };
  const validation = validatePortalSitemap(portal, stats);
  if (sitemap) {
    await B2BSitemap.updateOne(
      { portal_slug: portalSlug },
      { $set: { validation } },
    );
  }
  return validation;
}

// Exported for unit testing.
export const __test = {
  categoryRootForLocale,
  collectStaticEntries,
  storedType,
};
