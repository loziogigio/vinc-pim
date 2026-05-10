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
  meta_tags: IB2CStorefrontMetaTags;
  custom_scripts: IB2CCustomScript[];
  settings: IB2CStorefrontSettings;
  created_at: Date;
  updated_at: Date;
}

/** Response shape for GET portal when tenant is not migrated (synthesized from homesettings) */
export interface IB2BPortalSynthesized extends IB2BPortal {
  synthesized: true;
}
