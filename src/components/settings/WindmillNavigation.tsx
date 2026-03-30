"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ShoppingCart,
  PackageCheck,
  DollarSign,
  Package,
  Users,
  Search,
  ExternalLink,
  BookOpen,
  Zap,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

const sectionItems = [
  { labelKey: "nav.windmill.cart", href: "/b2b/windmill/cart", icon: ShoppingCart },
  { labelKey: "nav.windmill.order", href: "/b2b/windmill/order", icon: PackageCheck },
  { labelKey: "nav.windmill.pricing", href: "/b2b/windmill/pricing", icon: DollarSign },
  { labelKey: "nav.windmill.stock", href: "/b2b/windmill/stock", icon: Package },
  { labelKey: "nav.windmill.customer", href: "/b2b/windmill/customer", icon: Users },
  { labelKey: "nav.windmill.catalog", href: "/b2b/windmill/catalog", icon: Search },
];

export function WindmillNavigation() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const isActive = (href: string) => {
    const full = `${tenantPrefix}${href}`;
    return pathname === full;
  };

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-3 rounded-[0.358rem] px-4 py-2 text-[0.8rem] font-medium transition",
      isActive(href)
        ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
        : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]",
    );

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      {/* Header */}
      <div className="mb-2 pb-3 border-b border-[#ebe9f1]">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide">
            {t("nav.windmill.title")}
          </h2>
        </div>
      </div>

      {/* Main Config */}
      <Link href={`${tenantPrefix}/b2b/windmill`} className={linkClass("/b2b/windmill")}>
        <Settings className="h-4 w-4 flex-shrink-0" />
        <span>{t("nav.windmill.hookConfig")}</span>
      </Link>

      {/* Domain Sections */}
      <div className="mt-3 pt-3 border-t border-[#ebe9f1]">
        <h3 className="text-[0.7rem] font-semibold text-[#a6a4b0] uppercase tracking-wider mb-2 px-2">
          {t("nav.windmill.sections")}
        </h3>
        {sectionItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={`${tenantPrefix}${item.href}`} className={linkClass(item.href)}>
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="mt-3 pt-3 border-t border-[#ebe9f1]">
        <h3 className="text-[0.7rem] font-semibold text-[#a6a4b0] uppercase tracking-wider mb-2 px-2">
          {t("nav.windmill.quickLinks")}
        </h3>
        <a
          href={process.env.NEXT_PUBLIC_WINDMILL_URL || "http://149.81.163.109:8001/"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[0.358rem] px-4 py-2 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688] transition"
        >
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{t("nav.windmill.openWindmill")}</span>
        </a>
        <a
          href="https://www.windmill.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[0.358rem] px-4 py-2 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688] transition"
        >
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{t("nav.windmill.docs")}</span>
        </a>
      </div>
    </nav>
  );
}
