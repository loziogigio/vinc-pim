"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Ship,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

const navItems = [
  { labelKey: "nav.bookings.overview", path: "/b2b/bookings", icon: BarChart3 },
  { labelKey: "nav.bookings.departures", path: "/b2b/bookings/departures", icon: Ship },
  { labelKey: "nav.bookings.reservations", path: "/b2b/bookings/reservations", icon: CalendarCheck },
];

interface BookingsNavigationProps {
  tenantId?: string;
}

export function BookingsNavigation({ tenantId }: BookingsNavigationProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const buildHref = (path: string) => {
    return tenantId ? `/${tenantId}${path}` : path;
  };

  const isActive = (path: string) => {
    const href = buildHref(path);
    const baseHref = buildHref("/b2b/bookings");

    // Exact match for overview
    if (href === baseHref) {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      <div className="mb-2 pb-3 border-b border-[#ebe9f1]">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          {t("nav.bookings.title")}
        </h2>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const href = buildHref(item.path);
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium transition",
              active
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
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
