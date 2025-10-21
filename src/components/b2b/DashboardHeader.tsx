"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  LogOut,
  User,
  LayoutDashboard,
  Package,
  Settings,
  FileText,
  Upload
} from "lucide-react";
import type { B2BSessionData } from "@/lib/types/b2b";
import { cn } from "@/components/ui/utils";

type DashboardHeaderProps = {
  session: B2BSessionData;
  notificationCount?: number;
};

const navItems = [
  { label: "Dashboard", href: "/b2b/dashboard", icon: LayoutDashboard },
  { label: "Catalog", href: "/b2b/catalog", icon: Package },
  { label: "Import", href: "/b2b/import", icon: Upload },
  { label: "Activity", href: "/b2b/activity", icon: FileText },
  { label: "Settings", href: "/b2b/settings", icon: Settings },
];

export function DashboardHeader({ session, notificationCount = 0 }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/b2b/logout", { method: "POST" });
      router.push("/b2b/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const iconButtonClass =
    "relative flex h-[38px] w-[38px] items-center justify-center rounded-[5px] border-0 bg-transparent text-[#6e6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]";

  return (
    <header className="sticky top-0 z-50 border-b border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
      <div className="flex h-[64px] items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[0.428rem] bg-[#009688] text-white shadow-[0_4px_12px_rgba(0,150,136,0.25)]">
            <span className="text-[0.95rem] font-semibold">B2B</span>
          </div>
          <div className="leading-tight">
            <p className="text-[1rem] font-semibold text-[#5e5873]">VINC Trade Manager</p>
            <p className="text-[0.75rem] text-[#b9b9c3]">{session.companyName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" className={iconButtonClass} aria-label="Notifications">
            <Bell className="h-[1rem] w-[1rem]" />
            {notificationCount > 0 ? (
              <span className="absolute right-[6px] top-[6px] flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#ff5722] text-[0.625rem] font-semibold text-white shadow-sm">
                {notificationCount}
              </span>
            ) : null}
          </button>

          <div className="flex items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#009688] text-white">
              <User className="h-[0.95rem] w-[0.95rem]" />
            </div>
            <div className="text-[0.75rem] leading-snug">
              <p className="font-semibold text-[#5e5873]">{session.username}</p>
              <p className="text-[0.7rem] text-[#b9b9c3] capitalize">{session.role}</p>
            </div>
          </div>

          <button type="button" onClick={handleLogout} className={iconButtonClass} title="Logout">
            <LogOut className="h-[1rem] w-[1rem]" />
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-2 px-6 pb-4 pt-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-[0.358rem] px-3 py-1.5 text-[0.85rem] font-medium transition",
                isActive
                  ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                  : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
              )}
            >
              <Icon className="h-[0.95rem] w-[0.95rem]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
