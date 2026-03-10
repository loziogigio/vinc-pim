/**
 * B2C Sitemap Service
 *
 * Collects URLs (products, pages, categories) for B2C storefronts,
 * stores structured sitemap data in MongoDB, and notifies the B2C
 * frontend via Redis pub/sub to regenerate sitemap.xml and robots.txt.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getRedis } from "@/lib/cache/redis-client";
import type {
  IB2CSitemap,
  ISitemapUrl,
  ISitemapStats,
  ISitemapValidation,
} from "@/lib/db/models/b2c-sitemap";
import type { IB2CStorefront } from "@/lib/db/models/b2c-storefront";

const logPrefix = "[b2c-sitemap]";

/** Default disallow paths for robots.txt */
export const DEFAULT_ROBOTS_DISALLOW = [
  // API & internal
  "/api/",
  "/admin/",
  "/preview/",
  // Search (dynamic, query-dependent)
  "/search",
  // Auth pages
  "/pages/login",
  "/pages/register",
  "/pages/forgot-password",
  "/pages/update-password",
  "/pages/confirm-subscription",
  // Account (auth-protected)
  "/pages/account",
  "/pages/address",
  "/pages/change-password",
  "/pages/orders",
  "/pages/profile",
  "/pages/reminders",
  "/pages/wishlist",
  // Checkout & payment
  "/pages/cart",
  "/pages/pay",
  "/pages/payment-success",
  "/pages/payment-failed",
  // Guest order (token-protected)
  "/public/orders/",
];

// ============================================
// TYPES
// ============================================

export interface SitemapGenerationResult {
  stats: ISitemapStats;
  validation: ISitemapValidation;
  url_count: number;
}

// ============================================
// URL COLLECTION
// ============================================

/**
 * Collect all indexable URLs for a storefront's sitemap.
 */
async function collectSitemapUrls(
  tenantDb: string,
  storefront: { slug: string; channel: string; settings?: { default_language?: string } }
): Promise<{ urls: ISitemapUrl[]; locales: string[] }> {
  const { B2CPage, PIMProduct, Category, Language } = await connectWithModels(tenantDb);
  const urls: ISitemapUrl[] = [];

  // Resolve locales
  const enabledLangs = (await Language.find({ isEnabled: true })
    .select("code")
    .lean()) as Array<{ code: string }>;
  const locales = enabledLangs.length > 0
    ? enabledLangs.map((l) => l.code)
    : [storefront.settings?.default_language || "it"];

  // Helper: build alternates for a path pattern
  const buildAlternates = (pathFn: (locale: string) => string): Record<string, string> => {
    const alts: Record<string, string> = {};
    for (const locale of locales) {
      alts[locale] = pathFn(locale);
    }
    return alts;
  };

  // 1. Homepage
  for (const locale of locales) {
    urls.push({
      path: `/${locale}`,
      type: "homepage",
      lastmod: new Date(),
      changefreq: "daily",
      priority: 1.0,
      alternates: buildAlternates((l) => `/${l}`),
    });
  }

  // 2. Custom pages (active only)
  const pages = (await B2CPage.find({
    storefront_slug: storefront.slug,
    status: "active",
  })
    .select("slug updated_at")
    .lean()) as Array<{ slug: string; updated_at: Date }>;

  for (const page of pages) {
    for (const locale of locales) {
      urls.push({
        path: `/${locale}/portfolio/${page.slug}`,
        type: "page",
        lastmod: page.updated_at,
        changefreq: "weekly",
        priority: 0.6,
        alternates: buildAlternates((l) => `/${l}/portfolio/${page.slug}`),
      });
    }
  }

  // 3. Products (published in this channel)
  const productCursor = PIMProduct.find({
    channels: storefront.channel,
    status: "published",
  })
    .select("sku slug updated_at")
    .lean()
    .cursor();

  for await (const product of productCursor) {
    const p = product as unknown as {
      sku: string;
      slug?: Record<string, string>;
      updated_at: Date;
    };
    for (const locale of locales) {
      // Prefer locale-specific slug, fall back to SKU
      const productSlug = p.slug?.[locale] || p.sku;
      urls.push({
        path: `/${locale}/products/${productSlug}`,
        type: "product",
        lastmod: p.updated_at,
        changefreq: "daily",
        priority: 0.8,
        alternates: buildAlternates(
          (l) => `/${l}/products/${p.slug?.[l] || p.sku}`
        ),
      });
    }
  }

  // 4. Categories — find root by channel_code, then all descendants
  const rootCategory = (await Category.findOne({
    channel_code: storefront.channel,
  })
    .select("category_id slug")
    .lean()) as { category_id?: string; slug?: string } | null;

  if (rootCategory?.category_id) {
    // Get all categories in this tree (root + descendants via path)
    const allCategories = (await Category.find({
      is_active: { $ne: false },
      $or: [
        { channel_code: storefront.channel },
        { path: rootCategory.category_id },
      ],
    })
      .select("slug category_id path updated_at level")
      .lean()) as Array<{
      slug?: string;
      category_id?: string;
      path?: string[];
      updated_at?: Date;
      level?: number;
    }>;

    // Build category_id → slug map for hierarchical URL resolution
    const catSlugMap = new Map<string, string>();
    for (const c of allCategories) {
      if (c.category_id && c.slug) {
        catSlugMap.set(c.category_id, c.slug);
      }
    }

    for (const cat of allCategories) {
      const catSlug = cat.slug || "";
      if (!catSlug) continue;

      // Build hierarchical path: /root-slug/parent-slug/.../cat-slug
      const pathSlugs = (cat.path || []).map((id) => catSlugMap.get(id) || id);
      const fullPath = [...pathSlugs, catSlug].join("/");

      for (const locale of locales) {
        urls.push({
          path: `/${locale}/${fullPath}`,
          type: "category",
          lastmod: cat.updated_at,
          changefreq: "weekly",
          priority: 0.7,
          alternates: buildAlternates((l) => `/${l}/${fullPath}`),
        });
      }
    }
  }

  return { urls, locales };
}

// ============================================
// GENERATION
// ============================================

/**
 * Generate and persist sitemap data for a storefront.
 * Returns stats and validation results.
 */
export async function generateSitemapForStorefront(
  tenantDb: string,
  storefrontSlug: string
): Promise<SitemapGenerationResult> {
  const startTime = Date.now();
  const { B2CStorefront, B2CSitemap } = await connectWithModels(tenantDb);

  const storefront = (await B2CStorefront.findOne({
    slug: storefrontSlug,
  }).lean()) as IB2CStorefront | null;

  if (!storefront) {
    throw new Error(`Storefront "${storefrontSlug}" not found`);
  }

  // Collect URLs
  const { urls, locales } = await collectSitemapUrls(tenantDb, storefront);

  const stats: ISitemapStats = {
    total_urls: urls.length,
    homepage_urls: urls.filter((u) => u.type === "homepage").length,
    page_urls: urls.filter((u) => u.type === "page").length,
    product_urls: urls.filter((u) => u.type === "product").length,
    category_urls: urls.filter((u) => u.type === "category").length,
    locales,
    last_generated_at: new Date(),
    generation_duration_ms: Date.now() - startTime,
  };

  // Run validation
  const validation = await validateStorefront(storefront, stats);

  // Upsert sitemap document
  await B2CSitemap.findOneAndUpdate(
    { storefront_slug: storefrontSlug },
    {
      $set: {
        urls,
        stats,
        validation,
      },
      $setOnInsert: {
        storefront_slug: storefrontSlug,
        robots_config: {
          custom_rules: "",
          disallow: DEFAULT_ROBOTS_DISALLOW,
        },
      },
    },
    { upsert: true, new: true }
  );

  console.log(
    `${logPrefix} Generated sitemap for "${storefrontSlug}": ${stats.total_urls} URLs in ${stats.generation_duration_ms}ms`
  );

  // Notify B2C frontend to regenerate
  await notifySitemapUpdate(tenantDb, storefrontSlug);

  return { stats, validation, url_count: urls.length };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a storefront's sitemap readiness.
 */
function validateStorefront(
  storefront: IB2CStorefront,
  stats: ISitemapStats
): ISitemapValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check primary domain
  const domains = storefront.domains || [];
  const hasPrimary = domains.some(
    (d) => typeof d === "object" && d.is_primary
  );
  if (!hasPrimary) {
    errors.push("No primary domain configured — sitemap URLs need a base domain");
  }
  if (domains.length === 0) {
    errors.push("No domains configured for this storefront");
  }

  // Check status
  if (storefront.status !== "active") {
    errors.push("Storefront is inactive — search engines should not index it");
  }

  // Check robots directive contradiction
  const robotsDirective = storefront.meta_tags?.robots || "";
  if (
    robotsDirective.includes("noindex") &&
    stats.total_urls > 0
  ) {
    warnings.push(
      "robots meta tag is set to 'noindex' but sitemap contains URLs — this is contradictory"
    );
  }

  // Content warnings
  if (stats.product_urls === 0) {
    warnings.push("No published products in this channel — sitemap will only contain pages");
  }
  if (stats.page_urls === 0) {
    warnings.push("No active custom pages — consider adding pages for better SEO");
  }

  // Size warning (50k per sitemap file)
  if (stats.total_urls > 50000) {
    warnings.push(
      `Sitemap has ${stats.total_urls} URLs — the B2C frontend should split into multiple sitemap files (max 50,000 per file)`
    );
  }

  return {
    warnings,
    errors,
    last_validated_at: new Date(),
  };
}

/**
 * Run validation standalone (without regenerating URLs).
 */
export async function validateSitemap(
  tenantDb: string,
  storefrontSlug: string
): Promise<ISitemapValidation> {
  const { B2CStorefront, B2CSitemap } = await connectWithModels(tenantDb);

  const storefront = (await B2CStorefront.findOne({
    slug: storefrontSlug,
  }).lean()) as IB2CStorefront | null;

  if (!storefront) {
    throw new Error(`Storefront "${storefrontSlug}" not found`);
  }

  const sitemap = (await B2CSitemap.findOne({
    storefront_slug: storefrontSlug,
  }).lean()) as IB2CSitemap | null;

  const stats = sitemap?.stats || {
    total_urls: 0,
    homepage_urls: 0,
    page_urls: 0,
    product_urls: 0,
    category_urls: 0,
    locales: [],
    last_generated_at: new Date(),
    generation_duration_ms: 0,
  };

  const validation = validateStorefront(storefront, stats);

  // Persist validation results
  if (sitemap) {
    await B2CSitemap.updateOne(
      { storefront_slug: storefrontSlug },
      { $set: { validation } }
    );
  }

  return validation;
}

// ============================================
// ROBOTS CONFIG
// ============================================

/**
 * Update custom robots.txt rules for a storefront.
 */
export async function updateRobotsRules(
  tenantDb: string,
  storefrontSlug: string,
  customRules: string
): Promise<void> {
  const { B2CSitemap } = await connectWithModels(tenantDb);

  await B2CSitemap.findOneAndUpdate(
    { storefront_slug: storefrontSlug },
    {
      $set: { "robots_config.custom_rules": customRules },
      $setOnInsert: {
        storefront_slug: storefrontSlug,
        urls: [],
        stats: {},
        validation: {},
      },
    },
    { upsert: true }
  );

  // Notify B2C frontend
  await notifySitemapUpdate(tenantDb, storefrontSlug);

  console.log(`${logPrefix} Updated robots rules for "${storefrontSlug}"`);
}

/**
 * Get sitemap data for admin display.
 */
export async function getSitemapData(
  tenantDb: string,
  storefrontSlug: string
): Promise<IB2CSitemap | null> {
  const { B2CSitemap } = await connectWithModels(tenantDb);
  return B2CSitemap.findOne({ storefront_slug: storefrontSlug }).lean() as Promise<IB2CSitemap | null>;
}

// ============================================
// REDIS PUB/SUB NOTIFICATION
// ============================================

/**
 * Notify B2C frontend via Redis pub/sub that sitemap data has changed.
 * The frontend listens on this channel and regenerates sitemap.xml / robots.txt.
 *
 * Uses the same pattern as invalidateB2CCache() in redis-client.ts.
 */
async function notifySitemapUpdate(
  tenantDb: string,
  storefrontSlug: string
): Promise<void> {
  try {
    const r = getRedis();
    await r.publish(
      `vinc-b2c:cache-invalidate:${storefrontSlug}`,
      "sitemap"
    );
    console.log(`${logPrefix} Notified B2C to regenerate sitemap for "${storefrontSlug}"`);
  } catch (err) {
    console.warn(
      `${logPrefix} Failed to notify sitemap update:`,
      (err as Error).message
    );
  }
}

// ============================================
// DEBOUNCED REGENERATION
// ============================================

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 30_000; // 30 seconds

/**
 * Trigger sitemap regeneration with a 30-second debounce.
 * Multiple calls within the window coalesce into one generation.
 */
export function regenerateSitemapDebounced(
  tenantDb: string,
  storefrontSlug: string
): void {
  const key = `${tenantDb}:${storefrontSlug}`;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    key,
    setTimeout(async () => {
      debounceTimers.delete(key);
      try {
        await generateSitemapForStorefront(tenantDb, storefrontSlug);
      } catch (err) {
        console.error(
          `${logPrefix} Debounced regeneration failed for "${storefrontSlug}":`,
          (err as Error).message
        );
      }
    }, DEBOUNCE_MS)
  );

  console.log(
    `${logPrefix} Scheduled sitemap regeneration for "${storefrontSlug}" (30s debounce)`
  );
}
