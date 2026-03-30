"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Package,
  Search,
  FolderTree,
  Layers,
  Tag,
  Tags as TagsIcon,
  Cpu,
  Sliders,
  BookA,
  Menu,
  Languages,
  Upload,
  FileText,
  RefreshCw,
  Settings,
  Code2,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export interface DocSectionDef {
  slug: string;
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  pimHref?: string; // link to the actual PIM page (for "Go to section" button)
  highlight?: boolean; // visually highlight important sections
}

export const DOC_SECTIONS: DocSectionDef[] = [
  { slug: "overview", titleKey: "pages.pim.documentation.overviewTitle", descKey: "pages.pim.documentation.overviewDesc", icon: Box, pimHref: "/b2b/pim" },
  { slug: "products", titleKey: "pages.pim.documentation.productsTitle", descKey: "pages.pim.documentation.productsDesc", icon: Package, pimHref: "/b2b/pim/products" },
  { slug: "search-filters", titleKey: "pages.pim.documentation.searchTitle", descKey: "pages.pim.documentation.searchDesc", icon: Search, pimHref: "/b2b/pim/products" },
  { slug: "search-api", titleKey: "pages.pim.documentation.searchApiTitle", descKey: "pages.pim.documentation.searchApiDesc", icon: Globe, highlight: true },
  { slug: "categories", titleKey: "pages.pim.documentation.categoriesTitle", descKey: "pages.pim.documentation.categoriesDesc", icon: FolderTree, pimHref: "/b2b/pim/categories" },
  { slug: "collections", titleKey: "pages.pim.documentation.collectionsTitle", descKey: "pages.pim.documentation.collectionsDesc", icon: Layers, pimHref: "/b2b/pim/collections" },
  { slug: "brands", titleKey: "pages.pim.documentation.brandsTitle", descKey: "pages.pim.documentation.brandsDesc", icon: Tag, pimHref: "/b2b/pim/brands" },
  { slug: "tags", titleKey: "pages.pim.documentation.tagsTitle", descKey: "pages.pim.documentation.tagsDesc", icon: TagsIcon, pimHref: "/b2b/pim/tags" },
  { slug: "product-types", titleKey: "pages.pim.documentation.productTypesTitle", descKey: "pages.pim.documentation.productTypesDesc", icon: Cpu, pimHref: "/b2b/pim/product-types" },
  { slug: "tech-specs", titleKey: "pages.pim.documentation.techSpecsTitle", descKey: "pages.pim.documentation.techSpecsDesc", icon: Sliders, pimHref: "/b2b/pim/technical-specifications" },
  { slug: "synonyms", titleKey: "pages.pim.documentation.synonymsTitle", descKey: "pages.pim.documentation.synonymsDesc", icon: BookA, pimHref: "/b2b/pim/synonym-dictionaries" },
  { slug: "menu-settings", titleKey: "pages.pim.documentation.menuSettingsTitle", descKey: "pages.pim.documentation.menuSettingsDesc", icon: Menu, pimHref: "/b2b/pim/menu-settings" },
  { slug: "languages", titleKey: "pages.pim.documentation.languagesTitle", descKey: "pages.pim.documentation.languagesDesc", icon: Languages, pimHref: "/b2b/pim/languages" },
  { slug: "import", titleKey: "pages.pim.documentation.importTitle", descKey: "pages.pim.documentation.importDesc", icon: Upload, pimHref: "/b2b/pim/import" },
  { slug: "jobs", titleKey: "pages.pim.documentation.jobsTitle", descKey: "pages.pim.documentation.jobsDesc", icon: FileText, pimHref: "/b2b/pim/jobs" },
  { slug: "batch-sync", titleKey: "pages.pim.documentation.batchSyncTitle", descKey: "pages.pim.documentation.batchSyncDesc", icon: RefreshCw, pimHref: "/b2b/pim/batch-sync" },
  { slug: "sources", titleKey: "pages.pim.documentation.sourcesTitle", descKey: "pages.pim.documentation.sourcesDesc", icon: Settings, pimHref: "/b2b/pim/sources" },
  { slug: "api-reference", titleKey: "pages.pim.documentation.apiTitle", descKey: "pages.pim.documentation.apiDesc", icon: Code2 },
];

export function PIMDocumentation() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">
          {t("pages.pim.documentation.title")}
        </h1>
        <p className="mt-1 text-sm text-[#b9b9c3]">
          {t("pages.pim.documentation.subtitle")}
        </p>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.slug}
              href={`${tenantPrefix}/b2b/pim/documentation/${section.slug}`}
              className={`group flex flex-col rounded-[0.428rem] border p-5 transition hover:shadow-md ${
                section.highlight
                  ? "border-[#009688] bg-[rgba(0,150,136,0.04)] hover:bg-[rgba(0,150,136,0.08)]"
                  : "border-[#ebe9f1] bg-white hover:border-[#009688]"
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[0.358rem] bg-[rgba(0,150,136,0.12)]">
                  <Icon className="h-5 w-5 text-[#009688]" />
                </div>
                <h3 className="text-sm font-semibold text-[#5e5873] group-hover:text-[#009688]">
                  {t(section.titleKey)}
                </h3>
                <ChevronRight className="ml-auto h-4 w-4 text-[#b9b9c3] transition group-hover:translate-x-0.5 group-hover:text-[#009688]" />
              </div>
              <p className="text-xs leading-relaxed text-[#6e6b7b] line-clamp-2">
                {t(section.descKey)}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
