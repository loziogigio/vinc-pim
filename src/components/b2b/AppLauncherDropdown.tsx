"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid3X3, LogOut } from "lucide-react";
import { getLauncherApps } from "@/config/apps.config";
import { useTranslation } from "@/lib/i18n/useTranslation";

type AppLauncherDropdownProps = {
  tenantId?: string;
};

export function AppLauncherDropdown({ tenantId }: AppLauncherDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const tenantPrefix = tenantId ? `/${tenantId}` : "";

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

  const apps = getLauncherApps();

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        aria-label={t("header.apps")}
        title={t("header.apps")}
      >
        <Grid3X3 className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[300px] rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto overscroll-contain p-2">
            <div className="grid grid-cols-3 gap-0">
              {apps.map((app) => (
                <Link
                  key={app.id}
                  href={`${tenantPrefix}${app.href}`}
                  onClick={() => setIsOpen(false)}
                  className="group flex flex-col items-center gap-1.5 rounded-lg p-3 transition-colors hover:bg-accent"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${app.color} text-white transition-transform group-hover:scale-110`}
                  >
                    <app.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight line-clamp-2 min-h-[28px] flex items-center">
                    {t(`apps.${app.id}.name`)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
