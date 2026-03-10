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
  MapPin,
  FileText,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StorefrontActiveSection } from "@/components/b2c/storefront-settings/types";

const STOREFRONT_SECTIONS: {
  key: StorefrontActiveSection;
  icon: typeof Settings2;
  label: string;
}[] = [
  { key: "general", icon: Settings2, label: "General" },
  { key: "branding", icon: Palette, label: "Branding" },
  { key: "header", icon: LayoutTemplate, label: "Header" },
  { key: "footer", icon: FileCode2, label: "Footer" },
  { key: "seo", icon: Globe, label: "SEO & Meta Tags" },
  { key: "sitemap", icon: MapPin, label: "Sitemap" },
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
    <AppSidebar title="B2C Storefront">
      <NavLink
        href="/b2b/b2c"
        icon={LayoutDashboard}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/b2c/settings"
        icon={Settings}
        label="Settings"
      />
      {storefrontSlug && (
        <NavSection title={storefrontSlug} defaultOpen collapsible={false}>
          {STOREFRONT_SECTIONS.map((item) => (
            <StorefrontSectionLink
              key={item.key}
              href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}?section=${item.key}`}
              icon={item.icon}
              label={item.label}
              active={!subPage && currentSection === item.key}
            />
          ))}
          <StorefrontSectionLink
            href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/pages`}
            icon={FileText}
            label="Pages"
            active={subPage === "pages"}
          />
          <StorefrontSectionLink
            href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/forms`}
            icon={Inbox}
            label="Forms"
            active={subPage === "forms"}
          />
        </NavSection>
      )}
    </AppSidebar>
  );
}
