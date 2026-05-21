/**
 * B2B SEO Config Service
 *
 * Resolves the per-tenant SEO / routing config consumed by the B2B storefront
 * (seo-url spec §5.2): category URL root + robots rules. Reads the portal's
 * `seo_config` and fills safe defaults for any missing field.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  DEFAULT_CATEGORY_ROOT,
  DEFAULT_SEO_ROBOTS_DISALLOW,
  DEFAULT_PORTAL_SLUG,
  type IB2BPortal,
  type IB2BPortalSeoConfig,
} from "@/lib/types/b2b-portal";

/** §5.2 response shape. */
export interface SeoConfigResponse {
  categoryRoot: {
    default: string;
    [locale: string]: string;
  };
  robots: {
    noindex: boolean;
    allow: string[];
    disallow: string[];
    sitemapUrl: string;
  };
}

/**
 * Merge a portal's stored `seo_config` with safe defaults.
 * `categoryRoot.default` falls back to "categorie"; per-locale overrides are
 * preserved. Robots fields default to allow `/` and the standard disallow list.
 */
export function buildSeoConfig(
  seoConfig: IB2BPortalSeoConfig | undefined,
  host: string,
): SeoConfigResponse {
  const categoryRoot: SeoConfigResponse["categoryRoot"] = {
    default: DEFAULT_CATEGORY_ROOT,
  };

  const rawRoot = seoConfig?.category_root;
  if (rawRoot && typeof rawRoot === "object") {
    for (const [locale, value] of Object.entries(rawRoot)) {
      if (typeof value === "string" && value.trim()) {
        categoryRoot[locale] = value.trim();
      }
    }
  }
  if (!categoryRoot.default) categoryRoot.default = DEFAULT_CATEGORY_ROOT;

  const robots = seoConfig?.robots ?? {};
  const noindex = robots.noindex === true;

  const allow =
    Array.isArray(robots.allow) && robots.allow.length > 0
      ? robots.allow
      : ["/"];
  const disallow =
    Array.isArray(robots.disallow) && robots.disallow.length > 0
      ? robots.disallow
      : [...DEFAULT_SEO_ROBOTS_DISALLOW];

  // When noindex is set, the storefront emits `Disallow: /`; we surface that so
  // the consumer doesn't have to special-case it (allow is cleared too).
  const sitemapUrl = `https://${host}/sitemap.xml`;

  if (noindex) {
    return {
      categoryRoot,
      robots: { noindex: true, allow: [], disallow: ["/"], sitemapUrl },
    };
  }

  return {
    categoryRoot,
    robots: { noindex: false, allow, disallow, sitemapUrl },
  };
}

/**
 * Load a portal's SEO config (resolved by slug) and merge with defaults.
 * Returns defaults when no portal exists, so the endpoint never 404s.
 */
export async function getSeoConfig(
  tenantDb: string,
  host: string,
  portalSlug: string = DEFAULT_PORTAL_SLUG,
): Promise<SeoConfigResponse> {
  const { B2BPortal } = await connectWithModels(tenantDb);
  const portal = (await B2BPortal.findOne({ slug: portalSlug })
    .select("seo_config")
    .lean()) as Pick<IB2BPortal, "seo_config"> | null;

  return buildSeoConfig(portal?.seo_config, host);
}
