"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { cn } from "@/components/ui/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/b2b/correlations",
    icon: LayoutDashboard,
    description: "Overview & stats",
  },
  {
    label: "Articoli Correlati",
    href: "/b2b/correlations/related-products",
    icon: Link2,
    description: "Related products",
  },
  {
    label: "Analytics",
    href: "/b2b/correlations/analytics",
    icon: BarChart3,
    description: "Views & clicks",
    disabled: true,
  },
  {
    label: "Recommendations",
    href: "/b2b/correlations/recommendations",
    icon: Sparkles,
    description: "Auto-generated",
    disabled: true,
  },
];

export function CorrelationsNavigation() {
  const pathname = usePathname();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/correlations" -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      <div className="mb-2 pb-3 border-b border-[#ebe9f1]">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide">
          Correlazioni & Analytics
        </h2>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const fullHref = `${tenantPrefix}${item.href}`;
        // Special case for Dashboard: only match exact path
        const isActive = item.href === "/b2b/correlations"
          ? pathname === fullHref
          : pathname === fullHref || pathname?.startsWith(`${fullHref}/`);

        if (item.disabled) {
          return (
            <div
              key={item.href}
              className="flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium text-[#b9b9c3] cursor-not-allowed"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
              <span className="ml-auto text-[0.65rem] bg-[#f3f2f7] px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          );
        }

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
