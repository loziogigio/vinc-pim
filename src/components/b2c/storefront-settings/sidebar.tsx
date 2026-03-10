"use client";

import {
  Settings2,
  Palette,
  LayoutTemplate,
  FileCode2,
  Globe,
  MapPin,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { StorefrontActiveSection, SidebarItemConfig } from "./types";
import type { LucideIcon } from "lucide-react";

const SIDEBAR_ITEMS: SidebarItemConfig[] = [
  { key: "general", icon: Settings2, label: "General", description: "Name, domains, status" },
  { key: "branding", icon: Palette, label: "Branding", description: "Colors, logo, identity" },
  { key: "header", icon: LayoutTemplate, label: "Header", description: "Header rows & widgets" },
  { key: "footer", icon: FileCode2, label: "Footer", description: "Footer columns & links" },
  { key: "seo", icon: Globe, label: "SEO & Meta Tags", description: "Search engine optimization" },
  { key: "sitemap", icon: MapPin, label: "Sitemap", description: "Robots & sitemap config" },
];

function SidebarItem({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition-all",
        active
          ? "border-[#009688] bg-[#009688]/10 text-[#009688] shadow-sm"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-800"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            active
              ? "border-[#009688]/30 bg-[#009688]/15 text-[#009688]"
              : "border-slate-200 bg-white text-slate-500"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

export function StorefrontSidebar({
  activeSection,
  onSectionChange,
}: {
  activeSection: StorefrontActiveSection;
  onSectionChange: (section: StorefrontActiveSection) => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
      <nav className="space-y-2">
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            description={item.description}
            active={activeSection === item.key}
            onClick={() => onSectionChange(item.key)}
          />
        ))}
      </nav>
    </aside>
  );
}
