import type { LucideIcon } from "lucide-react";
import type {
  IB2CStorefrontBranding,
  IB2CStorefrontHeader,
  IB2CStorefrontFooter,
  IB2CStorefrontMetaTags,
  IStorefrontDomain,
} from "@/lib/db/models/b2c-storefront";
import type { HeaderConfig } from "@/lib/types/home-settings";

export type StorefrontActiveSection =
  | "general"
  | "branding"
  | "header"
  | "footer"
  | "seo"
  | "sitemap";

export interface SidebarItemConfig {
  key: StorefrontActiveSection;
  icon: LucideIcon;
  label: string;
  description: string;
}

export interface DomainEntry {
  protocol: "https" | "http";
  host: string;
  is_primary: boolean;
}

export {
  type IB2CStorefrontBranding,
  type IB2CStorefrontHeader,
  type IB2CStorefrontFooter,
  type IB2CStorefrontMetaTags,
  type IStorefrontDomain,
  type HeaderConfig,
};
