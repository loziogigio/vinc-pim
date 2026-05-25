"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Package,
  Upload,
  FileText,
  Settings,
  Sparkles,
  FolderTree,
  Layers,
  Cpu,
  Sliders,
  Tag,
  Tags as TagsIcon,
  Menu,
  Languages,
  BookA,
  RefreshCw,
  BookOpen,
  PanelLeftClose
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSidebarCollapsed } from "@/components/navigation/use-sidebar-collapsed";
import { SidebarReopenButton } from "@/components/navigation/SidebarReopenButton";

const navItems = [
  { labelKey: "nav.pim.overview", href: "/b2b/pim", icon: Box, descKey: "nav.pim.overviewDesc" },
  { labelKey: "nav.pim.products", href: "/b2b/pim/products", icon: Package, descKey: "nav.pim.productsDesc" },
  { labelKey: "nav.pim.categories", href: "/b2b/pim/categories", icon: FolderTree, descKey: "nav.pim.categoriesDesc" },
  { labelKey: "nav.pim.collections", href: "/b2b/pim/collections", icon: Layers, descKey: "nav.pim.collectionsDesc" },
  { labelKey: "nav.pim.synonyms", href: "/b2b/pim/synonym-dictionaries", icon: BookA, descKey: "nav.pim.synonymsDesc" },
  { labelKey: "nav.pim.brands", href: "/b2b/pim/brands", icon: Tag, descKey: "nav.pim.brandsDesc" },
  { labelKey: "nav.pim.tags", href: "/b2b/pim/tags", icon: TagsIcon, descKey: "nav.pim.tagsDesc" },
  { labelKey: "nav.pim.menuSettings", href: "/b2b/pim/menu-settings", icon: Menu, descKey: "nav.pim.menuSettingsDesc" },
  { labelKey: "nav.pim.languages", href: "/b2b/pim/languages", icon: Languages, descKey: "nav.pim.languagesDesc" },
  { labelKey: "nav.pim.productTypes", href: "/b2b/pim/product-types", icon: Cpu, descKey: "nav.pim.productTypesDesc" },
  { labelKey: "nav.pim.technicalSpecs", href: "/b2b/pim/technical-specifications", icon: Sliders, descKey: "nav.pim.technicalSpecsDesc" },
  { labelKey: "nav.pim.aiEnhancement", href: "/b2b/pim/ai-enhancement", icon: Sparkles, descKey: "nav.pim.aiEnhancementDesc" },
  { labelKey: "nav.pim.documentation", href: "/b2b/pim/documentation", icon: BookOpen, descKey: "nav.pim.documentationDesc" },
  { labelKey: "nav.pim.import", href: "/b2b/pim/import", icon: Upload, descKey: "nav.pim.importDesc" },
  { labelKey: "nav.pim.jobs", href: "/b2b/pim/jobs", icon: FileText, descKey: "nav.pim.jobsDesc" },
  { labelKey: "nav.pim.batchSync", href: "/b2b/pim/batch-sync", icon: RefreshCw, descKey: "nav.pim.batchSyncDesc" },
  { labelKey: "nav.pim.sources", href: "/b2b/pim/sources", icon: Settings, descKey: "nav.pim.sourcesDesc" }
];

export function PIMNavigation() {
  const pathname = usePathname();
  const { t } = useTranslation();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/pim/products" -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  // Collapsed: fully hide the nav and show a floating button to reopen it.
  if (collapsed) {
    return <SidebarReopenButton onClick={() => setCollapsed(false)} />;
  }

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-border bg-card p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="truncate text-sm font-semibold text-foreground uppercase tracking-wide">
          {t("nav.pim.title")}
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label={t("common.closeSidebar")}
          title={t("common.closeSidebar")}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const fullHref = `${tenantPrefix}${item.href}`;
        // Special case for Overview: only match exact path
        const isActive = item.href === "/b2b/pim"
          ? pathname === fullHref
          : pathname === fullHref || pathname?.startsWith(`${fullHref}/`);
        return (
          <Link
            key={item.href}
            href={fullHref}
            className={cn(
              "flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium transition",
              isActive
                ? "bg-primary/10 text-primary shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
