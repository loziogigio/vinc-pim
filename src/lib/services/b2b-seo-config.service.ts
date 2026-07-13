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
import type { IStorefrontDomain } from "@/lib/db/models/b2c-storefront";

/** §5.2 response shape. */
export interface SeoConfigResponse {
  /** Canonical storefront origin shared by metadata, JSON-LD and sitemap. */
  siteUrl: string;
  /** Sales channel that owns the portal's product/category tree. */
  channel?: string;
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

/** Category roots are URL path segments, never paths. Keep Unicode letters
 * and numbers for localized roots while rejecting slashes/query fragments. */
export function normalizeCategoryRootSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const segment = value.trim();
  if (!segment || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(segment)) return null;
  return segment;
}

function normalizeHost(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
    return parsed.host || null;
  } catch {
    return null;
  }
}

/** Prefer the portal's declared primary domain for canonical SEO URLs. The
 * request host is only a fallback (useful before domains are configured and
 * for synthesized legacy portals). */
export function canonicalHostForPortal(
  domains: IStorefrontDomain[] | undefined,
  requestHost: string,
): string {
  const primary = domains?.find((domain) => domain?.is_primary)?.domain;
  const first = domains?.find((domain) => Boolean(domain?.domain))?.domain;
  return (
    normalizeHost(primary) ||
    normalizeHost(first) ||
    normalizeHost(requestHost) ||
    "localhost"
  );
}

/**
 * Merge a portal's stored `seo_config` with safe defaults.
 * `categoryRoot.default` falls back to "categorie"; per-locale overrides are
 * preserved. Robots fields default to allow `/` and the standard disallow list.
 */
export function buildSeoConfig(
  seoConfig: IB2BPortalSeoConfig | undefined,
  host: string,
  channel?: string,
): SeoConfigResponse {
  const siteUrl = `https://${host}`;
  const categoryRoot: SeoConfigResponse["categoryRoot"] = {
    default: DEFAULT_CATEGORY_ROOT,
  };

  const rawRoot = seoConfig?.category_root;
  if (rawRoot && typeof rawRoot === "object") {
    for (const [locale, value] of Object.entries(rawRoot)) {
      const segment = normalizeCategoryRootSegment(value);
      if (segment) categoryRoot[locale] = segment;
    }
  }
  if (!categoryRoot.default) categoryRoot.default = DEFAULT_CATEGORY_ROOT;

  const robots = seoConfig?.robots ?? {};
  const noindex = robots.noindex === true;

  const allow = Array.isArray(robots.allow) ? robots.allow : ["/"];
  const disallow = Array.isArray(robots.disallow)
    ? robots.disallow
    : [...DEFAULT_SEO_ROBOTS_DISALLOW];

  // When noindex is set, the storefront emits `Disallow: /`; we surface that so
  // the consumer doesn't have to special-case it (allow is cleared too).
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  if (noindex) {
    return {
      siteUrl,
      ...(channel ? { channel } : {}),
      categoryRoot,
      robots: { noindex: true, allow: [], disallow: ["/"], sitemapUrl },
    };
  }

  return {
    siteUrl,
    ...(channel ? { channel } : {}),
    categoryRoot,
    robots: { noindex: false, allow, disallow, sitemapUrl },
  };
}

/** Preserve routing roots but fail closed for a portal that must not be
 * indexed (missing/inactive host configuration). */
export function buildNoindexSeoConfig(
  host: string,
  seoConfig?: IB2BPortalSeoConfig,
  channel?: string,
): SeoConfigResponse {
  return buildSeoConfig(
    {
      ...seoConfig,
      robots: { ...seoConfig?.robots, noindex: true },
    },
    host,
    channel,
  );
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
  const { B2BPortal, HomeSettings } = await connectWithModels(tenantDb);
  const portal = (await B2BPortal.findOne({ slug: portalSlug })
    .select("seo_config status domains channel")
    .lean()) as Pick<
    IB2BPortal,
    "seo_config" | "status" | "domains" | "channel"
  > | null;

  if (portal) {
    const canonicalHost = canonicalHostForPortal(portal.domains, host);
    return portal.status === "active"
      ? buildSeoConfig(portal.seo_config, canonicalHost, portal.channel)
      : buildNoindexSeoConfig(canonicalHost, portal.seo_config, portal.channel);
  }

  // Read-only compatibility for tenants that still use b2bhomesettings. A
  // missing non-default portal, or a tenant with no storefront config at all,
  // must not become indexable merely because defaults were applied.
  if (portalSlug === DEFAULT_PORTAL_SLUG && (await HomeSettings.exists({}))) {
    return buildSeoConfig(undefined, host);
  }

  return buildNoindexSeoConfig(host);
}
