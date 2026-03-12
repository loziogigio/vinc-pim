"use client";

import { usePathname } from "next/navigation";
import { User, Maximize2, Minimize2 } from "lucide-react";
import type { B2BSessionData } from "@/lib/types/b2b";
import { getCurrentSection } from "@/config/apps.config";
import { useLayoutStore } from "@/lib/stores/layoutStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AppLauncherDropdown } from "./AppLauncherDropdown";
import { UILanguageSwitcher } from "./UILanguageSwitcher";

type DashboardHeaderProps = {
  session: B2BSessionData;
};

export function DashboardHeader({ session }: DashboardHeaderProps) {
  const pathname = usePathname() || "";
  const currentSection = getCurrentSection(pathname);
  const { fullWidth, toggleFullWidth } = useLayoutStore();
  const { t } = useTranslation();

  const tenantId = session.tenantId;

  // Translate the section name using app id if available
  const sectionName = currentSection.id
    ? t(`apps.${currentSection.id}.name`)
    : currentSection.name;

  const iconButtonClass =
    "relative flex h-[38px] w-[38px] items-center justify-center rounded-[5px] border-0 bg-transparent text-[#6e6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]";

  return (
    <header className="sticky top-0 z-50 border-b border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
      <div className={fullWidth ? "px-6" : "mx-auto max-w-[1600px] px-6"}>
        <div className="flex h-[64px] items-center justify-between">
          {/* Left: Current Section */}
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-[0.428rem] ${currentSection.color} text-white shadow-lg`}>
              <currentSection.icon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-[1rem] font-semibold text-[#5e5873]">VINC {sectionName}</p>
              <p className="text-[0.75rem] text-[#b9b9c3]">{session.companyName}</p>
            </div>
          </div>

          {/* Right: Language Switcher + App Launcher + User */}
          <div className="flex items-center gap-3">
            {/* Full-width toggle */}
            <button
              type="button"
              className={iconButtonClass}
              aria-label={fullWidth ? t("header.switchToCompact") : t("header.switchToFullWidth")}
              title={fullWidth ? t("header.compactLayout") : t("header.fullWidthLayout")}
              onClick={toggleFullWidth}
            >
              {fullWidth ? <Minimize2 className="h-[1rem] w-[1rem]" /> : <Maximize2 className="h-[1rem] w-[1rem]" />}
            </button>

            {/* UI Language Switcher */}
            <UILanguageSwitcher />

            {/* Google-style App Launcher */}
            <AppLauncherDropdown tenantId={tenantId} />

            <div className="flex items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#009688] text-white">
                <User className="h-[0.95rem] w-[0.95rem]" />
              </div>
              <div className="text-[0.75rem] leading-snug">
                <p className="font-semibold text-[#5e5873]">{session.username}</p>
                <p className="text-[0.7rem] text-[#b9b9c3] capitalize">{session.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
