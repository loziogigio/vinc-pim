"use client";

import { usePathname } from "next/navigation";
import { User, Maximize2, Minimize2, Moon, Sun } from "lucide-react";
import type { B2BSessionData } from "@/lib/types/b2b";
import { getCurrentSection } from "@/config/apps.config";
import { useLayoutStore } from "@/lib/stores/layoutStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useTheme } from "@/hooks/useTheme";
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
  const { isDark, toggle: toggleTheme, initialized } = useTheme();

  const tenantId = session.tenantId;

  // Translate the section name using app id if available
  const sectionName = currentSection.id
    ? t(`apps.${currentSection.id}.name`)
    : currentSection.name;

  const iconButtonClass =
    "relative flex h-[38px] w-[38px] items-center justify-center rounded-[5px] border-0 bg-transparent text-muted-foreground transition hover:bg-accent hover:text-accent-foreground";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
      <div className={fullWidth ? "px-6" : "mx-auto max-w-[1600px] px-6"}>
        <div className="flex h-[64px] items-center justify-between">
          {/* Left: Current Section */}
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[0.428rem] ${currentSection.color} text-white shadow-lg`}>
              <currentSection.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[1rem] font-semibold text-foreground">VINC {sectionName}</p>
              <p className="hidden truncate text-[0.75rem] text-muted-foreground sm:block">{session.companyName}</p>
            </div>
          </div>

          {/* Right: Theme Toggle + Language Switcher + App Launcher + User */}
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Light/Dark theme toggle */}
            <button
              type="button"
              className={iconButtonClass}
              aria-label={isDark ? t("header.switchToLight") : t("header.switchToDark")}
              aria-pressed={isDark}
              title={isDark ? t("header.lightMode") : t("header.darkMode")}
              onClick={toggleTheme}
              disabled={!initialized}
            >
              {isDark ? <Sun className="h-[1rem] w-[1rem]" /> : <Moon className="h-[1rem] w-[1rem]" />}
            </button>

            {/* Full-width toggle (desktop only — layout width has no effect on mobile) */}
            <button
              type="button"
              className={`${iconButtonClass} hidden md:flex`}
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

            <div className="flex items-center gap-2 rounded-[0.428rem] border border-border bg-muted px-2 py-2 sm:px-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-[0.95rem] w-[0.95rem]" />
              </div>
              <div className="hidden text-[0.75rem] leading-snug sm:block">
                <p className="font-semibold text-foreground">{session.username}</p>
                <p className="text-[0.7rem] text-muted-foreground capitalize">{session.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
