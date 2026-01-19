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
  BookA
} from "lucide-react";
import { cn } from "@/components/ui/utils";

const navItems = [
  { label: "Overview", href: "/b2b/pim", icon: Box, description: "Catalog quality snapshot" },
  { label: "Products", href: "/b2b/pim/products", icon: Package, description: "Master list (CRUD)" },
  { label: "Categories", href: "/b2b/pim/categories", icon: FolderTree, description: "Hierarchical structure" },
  { label: "Collections", href: "/b2b/pim/collections", icon: Layers, description: "Flexible grouping" },
  { label: "Synonyms", href: "/b2b/pim/synonym-dictionaries", icon: BookA, description: "Search synonyms" },
  { label: "Brands", href: "/b2b/pim/brands", icon: Tag, description: "Product brands" },
  { label: "Tags", href: "/b2b/pim/tags", icon: TagsIcon, description: "Reusable labels" },
  { label: "Menu Settings", href: "/b2b/pim/menu-settings", icon: Menu, description: "Navigation builder" },
  { label: "Languages", href: "/b2b/pim/languages", icon: Languages, description: "Multilingual support" },
  { label: "Product Types", href: "/b2b/pim/product-types", icon: Cpu, description: "Features" },
  { label: "Features", href: "/b2b/pim/features", icon: Sliders, description: "Reusable attributes" },
  { label: "AI Enhancement", href: "/b2b/pim/ai-enhancement", icon: Sparkles, description: "Generate content" },
  { label: "Import", href: "/b2b/pim/import", icon: Upload, description: "CSV/API for products" },
  { label: "Jobs", href: "/b2b/pim/jobs", icon: FileText, description: "AI / Import / Sync tasks" },
  { label: "Sources", href: "/b2b/pim/sources", icon: Settings, description: "Data origins" }
];

export function PIMNavigation() {
  const pathname = usePathname();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/pim/products" -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      <div className="mb-2 pb-3 border-b border-[#ebe9f1]">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide">
          PIM System
        </h2>
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
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
