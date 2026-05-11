/**
 * B2B Portal Migration Service
 *
 * Pure field-mapping functions for the b2bhomesettings → b2bportals migration.
 * Used by both the migration script and the API read-through fallback.
 * No DB access in this module.
 *
 * Mapping notes:
 *  - CompanyBranding (camelCase: logo, primaryColor, ...) → IB2CStorefrontBranding (snake_case: logo_url, primary_color, ...)
 *  - HomeSettings.headerConfig / headerConfigDraft (camelCase) → IB2BPortal.header_config / header_config_draft
 *  - HomeSettings.footerHtml / footerHtmlDraft (strings) → IB2BPortal.footer.footer_html / footer_draft.footer_html_draft
 *  - MetaTags (camelCase: canonicalUrl, ogTitle, ...) → IB2CStorefrontMetaTags (snake_case: canonical_url, og_title, ...)
 *  - HomeSettings has no custom_scripts field → portal.custom_scripts defaults to []
 */

import type { HomeSettings, MetaTags } from "@/lib/types/home-settings";
import type {
  IB2CStorefrontBranding,
  IB2CStorefrontFooter,
  IB2CStorefrontMetaTags,
} from "@/lib/db/models/b2c-storefront";
import type { IB2BPortal } from "@/lib/types/b2b-portal";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";

// ============================================================================
// Private mapping helpers
// ============================================================================

/**
 * Map CompanyBranding (camelCase) to IB2CStorefrontBranding (snake_case).
 */
function mapBranding(
  src: HomeSettings["branding"] | undefined,
): IB2CStorefrontBranding {
  if (!src) return {};
  return {
    title: src.title,
    logo_url: src.logo,
    favicon_url: src.favicon,
    primary_color: src.primaryColor,
    secondary_color: src.secondaryColor,
    accent_color: src.accentColor,
    // font_family has no counterpart in CompanyBranding; leave undefined
  };
}

/**
 * Map MetaTags (camelCase) to IB2CStorefrontMetaTags (snake_case).
 */
function mapMetaTags(
  src: MetaTags | undefined,
): IB2CStorefrontMetaTags {
  if (!src) return {};
  return {
    title: src.title,
    description: src.description,
    keywords: src.keywords,
    author: src.author,
    robots: src.robots,
    canonical_url: src.canonicalUrl,
    og_title: src.ogTitle,
    og_description: src.ogDescription,
    og_image: src.ogImage,
    og_site_name: src.ogSiteName,
    og_type: src.ogType,
    twitter_card: src.twitterCard,
    twitter_site: src.twitterSite,
    twitter_creator: src.twitterCreator,
    twitter_image: src.twitterImage,
    theme_color: src.themeColor,
    google_site_verification: src.googleSiteVerification,
    bing_site_verification: src.bingSiteVerification,
    structured_data: src.structuredData,
  };
}

/**
 * Map the published footer HTML string + branding footer colors to an
 * IB2CStorefrontFooter. HomeSettings stores footer content as a raw HTML
 * string (footerHtml) and footer colors on branding
 * (footerBackgroundColor / footerTextColor), while IB2CStorefrontFooter
 * holds footer_html / bg_color / text_color.
 */
function mapFooter(
  footerHtml: string | undefined,
  branding: HomeSettings["branding"] | undefined,
): IB2CStorefrontFooter {
  return {
    footer_html: footerHtml,
    ...(branding?.footerBackgroundColor ? { bg_color: branding.footerBackgroundColor } : {}),
    ...(branding?.footerTextColor ? { text_color: branding.footerTextColor } : {}),
  };
}

/**
 * Map the draft footer HTML string to an IB2CStorefrontFooter draft, or
 * return undefined if no draft HTML is present.
 */
function mapFooterDraft(
  footerHtmlDraft: string | undefined,
): IB2CStorefrontFooter | undefined {
  if (!footerHtmlDraft) return undefined;
  return {
    footer_html_draft: footerHtmlDraft,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Map the portal-scoped fields of a HomeSettings document into an IB2BPortal shape.
 *
 * Does NOT touch the global fields that remain in b2bhomesettings:
 *   smtp_settings, email_transport, graph_settings, company_info,
 *   cdn, cdn_credentials, cardStyle, defaultCardVariant, image_versions,
 *   web_push_settings, fcm_settings, windmill_proxy.
 *
 * @param settings  - The HomeSettings document (or partial; missing fields default safely).
 * @param tenantDisplayName - Human-readable tenant name used as portal.name.
 * @returns         A plain IB2BPortal object (no Mongoose document, no DB I/O).
 */
export function buildPortalFromHomeSettings(
  settings: HomeSettings,
  tenantDisplayName: string,
): IB2BPortal {
  const shopUrl = settings.branding?.shopUrl;
  const domains = shopUrl
    ? [{ domain: shopUrl, is_primary: true }]
    : [];

  const headerConfig = settings.headerConfig
    ? { ...settings.headerConfig }
    : { rows: [] };

  const headerConfigDraft = settings.headerConfigDraft
    ? { ...settings.headerConfigDraft }
    : undefined;

  const footer = mapFooter(settings.footerHtml, settings.branding);
  const footerDraft = mapFooterDraft(settings.footerHtmlDraft);

  return {
    slug: DEFAULT_PORTAL_SLUG,
    name: tenantDisplayName,
    channel: "default",
    domains,
    status: "active",
    branding: mapBranding(settings.branding),
    header_config: headerConfig,
    ...(headerConfigDraft !== undefined && { header_config_draft: headerConfigDraft }),
    footer,
    ...(footerDraft !== undefined && { footer_draft: footerDraft }),
    meta_tags: mapMetaTags(settings.meta_tags),
    // HomeSettings has no custom_scripts — portal starts with an empty array
    custom_scripts: [],
    settings: {},
    created_at: new Date(),
    updated_at: new Date(),
  };
}
