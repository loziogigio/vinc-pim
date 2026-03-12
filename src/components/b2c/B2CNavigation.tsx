"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar, NavLink, NavSection } from "@/components/navigation";
import {
  LayoutDashboard,
  Settings,
  Settings2,
  Palette,
  LayoutTemplate,
  FileCode2,
  Globe,
  Code2,
  MapPin,
  FileText,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StorefrontActiveSection } from "@/components/b2c/storefront-settings/types";
import { useTranslation } from "@/lib/i18n/useTranslation";

const STOREFRONT_SECTIONS: {
  key: StorefrontActiveSection;
  icon: typeof Settings2;
  labelKey: string;
}[] = [
  { key: "general", icon: Settings2, labelKey: "nav.b2c.general" },
  { key: "branding", icon: Palette, labelKey: "nav.b2c.branding" },
  { key: "header", icon: LayoutTemplate, labelKey: "nav.b2c.header" },
  { key: "footer", icon: FileCode2, labelKey: "nav.b2c.footer" },
  { key: "seo", icon: Globe, labelKey: "nav.b2c.seoMetaTags" },
  { key: "scripts", icon: Code2, labelKey: "nav.b2c.customScripts" },
  { key: "sitemap", icon: MapPin, labelKey: "nav.b2c.sitemap" },
];

function StorefrontSectionLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: typeof Settings2;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors pl-7",
        active
          ? "bg-[#009688]/10 text-[#009688] font-medium"
          : "text-[#6e6b7b] hover:bg-[#f8f8f8] hover:text-[#5e5873]"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

export function B2CNavigation() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // Detect if we're on a storefront detail page: /tenant/b2b/b2c/storefronts/[slug] or sub-pages
  const storefrontMatch = pathname.match(
    /\/b2b\/b2c\/storefronts\/([^/]+)/
  );
  const storefrontSlug = storefrontMatch?.[1] || null;
  const subPage = pathname.match(/\/storefronts\/[^/]+\/(\w+)$/)?.[1] || null;
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const currentSection = searchParams.get("section") || "general";

  return (
    <AppSidebar title={t("nav.b2c.title")}>
      <NavLink
        href="/b2b/b2c"
        icon={LayoutDashboard}
        label={t("nav.b2c.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/b2c/settings"
        icon={Settings}
        label={t("nav.b2c.settings")}
      />
      {storefrontSlug && (
        <NavSection title={storefrontSlug} defaultOpen collapsible={false}>
          {STOREFRONT_SECTIONS.map((item) => (
            <StorefrontSectionLink
              key={item.key}
              href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}?section=${item.key}`}
              icon={item.icon}
              label={t(item.labelKey)}
              active={!subPage && currentSection === item.key}
            />
          ))}
          <StorefrontSectionLink
            href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/pages`}
            icon={FileText}
            label={t("nav.b2c.pages")}
            active={subPage === "pages"}
          />
          <StorefrontSectionLink
            href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/forms`}
            icon={Inbox}
            label={t("nav.b2c.forms")}
            active={subPage === "forms"}
          />
        </NavSection>
      )}
    </AppSidebar>
  );
}
