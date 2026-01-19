"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Grid3X3,
  Package,
  Store,
  Users,
  KeyRound,
  LayoutDashboard,
  Settings,
  LogOut,
  Home,
} from "lucide-react";

const apps = [
  { name: "Home", href: "/b2b", icon: Home, color: "bg-[#009688]" },
  { name: "PIM", href: "/b2b/pim", icon: Package, color: "bg-violet-500" },
  { name: "Store", href: "/b2b/store/orders", icon: Store, color: "bg-amber-500" },
  { name: "Customers", href: "/b2b/store/customers", icon: Users, color: "bg-emerald-500" },
  { name: "Portal Users", href: "/b2b/store/portal-users", icon: KeyRound, color: "bg-indigo-500" },
  { name: "Builder", href: "/b2b/home-builder", icon: LayoutDashboard, color: "bg-blue-500" },
  { name: "Settings", href: "/b2b/home-settings", icon: Settings, color: "bg-slate-500" },
];

type AppLauncherDropdownProps = {
  tenantId?: string;
};

export function AppLauncherDropdown({ tenantId }: AppLauncherDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const tenantPrefix = tenantId ? `/${tenantId}` : "";

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await fetch(`${tenantPrefix}/api/b2b/logout`, { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* 9-dot grid button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#6e6b7b] transition hover:bg-[#f1f1f2]"
        aria-label="Apps"
        title="Apps"
      >
        <Grid3X3 className="h-5 w-5" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[280px] rounded-2xl border border-[#ebe9f1] bg-white shadow-xl z-50">
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {apps.map((app) => (
                <Link
                  key={app.name}
                  href={`${tenantPrefix}${app.href}`}
                  onClick={() => setIsOpen(false)}
                  className="group flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-[#f8f8f8]"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${app.color} text-white shadow-md transition group-hover:scale-105`}
                  >
                    <app.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium text-[#5e5873]">
                    {app.name}
                  </span>
                </Link>
              ))}

              {/* Logout */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="group flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-[#f8f8f8]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition group-hover:scale-105">
                  <LogOut className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-[#5e5873]">
                  Logout
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
