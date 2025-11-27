"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, User, Home } from "lucide-react";
import type { B2BSessionData } from "@/lib/types/b2b";

type DashboardHeaderProps = {
  session: B2BSessionData;
  notificationCount?: number;
};


export function DashboardHeader({ session, notificationCount = 0 }: DashboardHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/b2b/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const iconButtonClass =
    "relative flex h-[38px] w-[38px] items-center justify-center rounded-[5px] border-0 bg-transparent text-[#6e6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]";

  return (
    <header className="sticky top-0 z-50 border-b border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="flex h-[64px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-[0.428rem] bg-[#6e6b7b] text-white transition hover:bg-[#5e5873] shadow-[0_4px_12px_rgba(110,107,123,0.25)]"
              title="Back to App Launcher"
            >
              <Home className="h-5 w-5" />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-[0.428rem] bg-[#009688] text-white shadow-[0_4px_12px_rgba(0,150,136,0.25)]">
              <span className="text-[0.95rem] font-semibold">B2B</span>
            </div>
            <div className="leading-tight">
              <p className="text-[1rem] font-semibold text-[#5e5873]">VINC PIM</p>
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
      </div>
    </header>
  );
}
