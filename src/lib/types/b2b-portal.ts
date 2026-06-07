/**
 * B2B Portal Types
 *
 * Shared types for the B2B portal data model.
 * Shape is identical to B2C storefront types where possible;
 * re-exports B2C primitives to avoid duplication.
 */

import type {
  IB2CStorefrontBranding,
  IB2CStorefrontFooter,
  IB2CStorefrontMetaTags,
  IB2CCustomScript,
  IStorefrontDomain,
  IB2CStorefrontSettings,
} from "@/lib/db/models/b2c-storefront";
import type { HeaderConfig } from "@/lib/types/home-settings";

export const B2B_PORTAL_STATUSES = ["active", "inactive"] as const;
export type B2BPortalStatus = (typeof B2B_PORTAL_STATUSES)[number];

export const DEFAULT_PORTAL_SLUG = "default";

/** Default category root segment when none is configured (see seo-url spec §5.2 / D2). */
export const DEFAULT_CATEGORY_ROOT = "categorie";

/** Default robots disallow rules for a B2B portal (mirrors B2BSitemapSchema defaults). */
export const DEFAULT_SEO_ROBOTS_DISALLOW = [
  "/api/",
  "/account/",
  "/checkout/",
  "/complete-order/",
  "/*?preview=true",
] as const;

/**
 * Per-tenant SEO / routing config consumed by the B2B storefront.
 * See seo-url spec §5.2.
 */
export interface IB2BPortalSeoConfig {
  /**
   * Category URL root segment. `default` falls back to "categorie".
   * Optional per-locale overrides (e.g. { it: "prodotti", en: "products" }).
   */
  category_root?: {
    default?: string;
    [locale: string]: string | undefined;
  };
  robots?: {
    /** When true the storefront emits `Disallow: /` (de-index the whole site). */
    noindex?: boolean;
    allow?: string[];
    disallow?: string[];
  };
}

/** One configured facet entry on a portal's listing sidebar. */
export interface IB2BPortalFacetEntry {
  /** Solr facet field key, e.g. "brand_id", "spec_color_s". */
  field: string;
  /** Whether the facet is shown on the storefront sidebar. */
  visible: boolean;
  /** Optional label override. Reserved — unused in v1. */
  label?: string;
}

/** Per-portal facet sidebar config. Display order = array order of entries. */
export interface IB2BPortalFacetConfig {
  entries: IB2BPortalFacetEntry[];
}

/** Root B2B portal document */
export interface IB2BPortal {
  _id?: string;
  slug: string;
  name: string;
  channel: string;
  domains: IStorefrontDomain[];
  status: B2BPortalStatus;
  branding: IB2CStorefrontBranding;
  header_config: HeaderConfig;
  header_config_draft?: HeaderConfig;
  footer: IB2CStorefrontFooter;
  footer_draft?: IB2CStorefrontFooter;
  header_config_by_lang?: Record<string, HeaderConfig>;
  header_config_draft_by_lang?: Record<string, HeaderConfig>;
  footer_by_lang?: Record<string, IB2CStorefrontFooter>;
  footer_draft_by_lang?: Record<string, IB2CStorefrontFooter>;
  meta_tags: IB2CStorefrontMetaTags;
  custom_scripts: IB2CCustomScript[];
  /** Custom CSS injected into the storefront <head> */
  custom_css?: string;
  settings: IB2CStorefrontSettings;
  /** SEO / routing config consumed by the storefront (category root + robots). */
  seo_config?: IB2BPortalSeoConfig;
  /** Per-portal facet sidebar config consumed by the storefront. */
  facet_config?: IB2BPortalFacetConfig;
  created_at: Date;
  updated_at: Date;
}

/** Response shape for GET portal when tenant is not migrated (synthesized from homesettings) */
export interface IB2BPortalSynthesized extends IB2BPortal {
  synthesized: true;
}
