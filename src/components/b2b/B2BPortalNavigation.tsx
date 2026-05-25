"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { AppSidebar, NavLink, NavSection } from "@/components/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { StorefrontActiveSection } from "@/components/b2c/storefront-settings/types";

/**
 * The 7 portal-detail sections (?section=...). Mirrors STOREFRONT_SECTIONS in
 * B2CNavigation — the B2B portal detail page reuses the same B2C section
 * components, so the section keys and labels are shared.
 */
const PORTAL_SECTIONS: {
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

function PortalSectionLink({
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
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

export function B2BPortalNavigation() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // Detect a portal detail page: /[tenant]/b2b/b2b/portals/[slug] (and sub-pages).
  const portalMatch = pathname.match(/\/b2b\/b2b\/portals\/([^/]+)/);
  const portalSlug = portalMatch?.[1] || null;
  // A trailing path segment after the slug (e.g. /portals/foo/pages) — Phase 3,
  // but tracked so the section links don't show "active" on those pages.
  const subPage = pathname.match(/\/portals\/[^/]+\/(\w+)$/)?.[1] || null;
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const currentSection = searchParams.get("section") || "general";

  return (
    <AppSidebar title={t("nav.b2bPortal.title")}>
      <NavLink
        href="/b2b/b2b"
        icon={LayoutDashboard}
        label={t("nav.b2bPortal.portals")}
        exactMatch
      />
      <NavLink
        href="/b2b/b2b/settings"
        icon={Settings}
        label={t("nav.b2bPortal.settings")}
      />
      {portalSlug && (
        <NavSection title={portalSlug} defaultOpen collapsible={false}>
          {PORTAL_SECTIONS.map((item) => (
            <PortalSectionLink
              key={item.key}
              href={`${tenantPrefix}/b2b/b2b/portals/${portalSlug}?section=${item.key}`}
              icon={item.icon}
              label={t(item.labelKey)}
              active={!subPage && currentSection === item.key}
            />
          ))}
          <PortalSectionLink
            href={`${tenantPrefix}/b2b/b2b/portals/${portalSlug}/pages`}
            icon={FileText}
            label={t("nav.b2bPortal.pages")}
            active={subPage === "pages"}
          />
          <PortalSectionLink
            href={`${tenantPrefix}/b2b/b2b/portals/${portalSlug}/forms`}
            icon={Inbox}
            label={t("nav.b2bPortal.forms")}
            active={subPage === "forms"}
          />
        </NavSection>
      )}
    </AppSidebar>
  );
}
