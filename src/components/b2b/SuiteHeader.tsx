"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Bell, LayoutGrid, LogOut, Maximize2, Minimize2, Moon, Sun } from "lucide-react";
import { getCurrentSection } from "@/config/apps.config";
import { useLayoutStore } from "@/lib/stores/layoutStore";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { contentWidthClass } from "@/lib/utils/layout";
import { initialsOf } from "@/lib/utils/user-display";
import { AppLauncherDropdown } from "./AppLauncherDropdown";
import { UILanguageSwitcher } from "./UILanguageSwitcher";
import { ModuleSearch } from "./ModuleSearch";

interface SuiteHeaderProps {
  tenant: string;
  username?: string;
  email?: string;
  role?: string;
  companyName?: string;
}

/**
 * Single merged petrol Commerce Suite header used on every authenticated surface
 * (Home, Centro Moduli, the article reader, and all protected/builder pages).
 * Union of the former SuiteAppBar + DashboardHeader: logo, tenant chip,
 * current-section indicator, module command palette, app launcher, theme/full-width
 * toggles, language switcher, notifications, account, and explicit logout.
 * `.vinc-login` self-scopes the petrol tokens to the header element only.
 */
export function SuiteHeader({ tenant, username, email, role, companyName }: SuiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { fullWidth, toggleFullWidth } = useLayoutStore();
  const { t } = useTranslation();
  const { isDark, toggle: toggleTheme, initialized } = useTheme();

  const section = getCurrentSection(pathname);
  const SectionIcon = pathname.endsWith("/b2b/moduli") ? LayoutGrid : section.icon;
  const sectionName = pathname.endsWith("/b2b/moduli")
    ? t("header.moduleCenter")
    : section.id
      ? t(`apps.${section.id}.name`)
      : section.name;

  const accountLabel = username || email || "Admin";

  const handleLogout = async () => {
    await fetch(`/${tenant}/api/b2b/logout`, { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="vinc-login appbar bd-line sticky top-0 z-50 border-b">
      <div className={`flex h-[62px] items-center gap-3 px-4 sm:px-6 lg:px-8 ${contentWidthClass(fullWidth)}`}>
        {/* logo + wordmark */}
        <Link href={`/${tenant}/b2b`} className="flex shrink-0 items-center gap-2.5" aria-label="CommerceSuite — home">
          <Image src="/vinc-logo.png" alt="" width={30} height={30} className="h-[30px] w-[30px]" priority />
          <span className="display c-ink text-[1.02rem] font-bold leading-none">
            Commerce<span className="c-accent">Suite</span>
          </span>
        </Link>

        {/* tenant chip */}
        <span className="bd-line ml-2 hidden items-center gap-2 rounded-lg border bg-[var(--vinc-surface)] px-2.5 py-1.5 sm:flex">
          <span className="display grid h-6 w-6 place-items-center rounded-md bg-[var(--vinc-accent)] text-[0.7rem] font-bold text-white">
            {initialsOf(tenant)}
          </span>
          <span className="mono c-ink-60 text-[0.72rem] leading-none">{tenant}</span>
        </span>

        <span className="bd-line mx-1 hidden h-6 w-px border-l sm:block" />

        {/* current section */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="mic h-9 w-9">
            <SectionIcon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="c-ink truncate text-[0.95rem] font-semibold">VINC {sectionName}</p>
            {companyName ? (
              <p className="c-ink-45 hidden truncate text-[0.72rem] sm:block">{companyName}</p>
            ) : null}
          </div>
        </div>

        {/* module command palette — grows to fill so the right-side controls pin to the content edge */}
        <ModuleSearch tenant={tenant} />

        {/* right controls */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1 md:ml-2">
          <AppLauncherDropdown tenantId={tenant} />

          <button
            type="button"
            className="iconbtn"
            aria-label={isDark ? t("header.switchToLight") : t("header.switchToDark")}
            aria-pressed={isDark}
            title={isDark ? t("header.lightMode") : t("header.darkMode")}
            onClick={toggleTheme}
            disabled={!initialized}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          <button
            type="button"
            className="iconbtn hidden md:flex"
            aria-label={fullWidth ? t("header.switchToCompact") : t("header.switchToFullWidth")}
            title={fullWidth ? t("header.compactLayout") : t("header.fullWidthLayout")}
            onClick={toggleFullWidth}
          >
            {fullWidth ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
          </button>

          <UILanguageSwitcher />

          <button className="iconbtn relative" aria-label={t("header.notifications")} title={t("header.notifications")}>
            <Bell className="h-[18px] w-[18px]" />
            <span className="badge-dot" />
          </button>

          <span className="bd-line mx-1 hidden h-6 w-px border-l sm:block" />

          <span className="flex items-center gap-2.5 py-1 pl-1.5 pr-1">
            <span className="display grid h-8 w-8 place-items-center rounded-full bg-[var(--vinc-deep)] text-[0.72rem] font-bold text-white">
              {initialsOf(accountLabel)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="c-ink block text-[0.82rem] font-semibold">{accountLabel}</span>
              <span className="mono c-ink-45 block text-[0.6rem] uppercase">{role || "Utente"}</span>
            </span>
          </span>

          <button onClick={handleLogout} className="iconbtn" aria-label={t("header.logout")} title={t("header.logout")}>
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
