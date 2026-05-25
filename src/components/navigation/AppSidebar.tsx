"use client";

import type { ReactNode } from "react";
import { PanelLeftClose, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";
import { SidebarReopenButton } from "./SidebarReopenButton";

export interface AppSidebarProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}

/**
 * Standard sidebar wrapper for app navigation
 * Provides consistent styling across all apps
 */
export function AppSidebar({ title, icon: Icon, children }: AppSidebarProps) {
  const { t } = useTranslation();
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  // Collapsed: fully hide the sidebar and show a floating button to reopen it.
  if (collapsed) {
    return <SidebarReopenButton onClick={() => setCollapsed(false)} />;
  }

  return (
    <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border bg-card flex-shrink-0 lg:sticky lg:top-[64px] max-h-[50vh] lg:max-h-none lg:h-[calc(100vh-64px)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-5 h-5 text-primary flex-shrink-0" />}
            <h2 className="font-semibold text-foreground truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label={t("common.closeSidebar")}
            title={t("common.closeSidebar")}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="p-2 space-y-0.5 flex-1">{children}</nav>

      {/* Footer */}
      <div className="p-3 border-t border-border text-center space-y-1">
        <a
          href="https://vendereincloud.it"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {t("common.providedBy")}
        </a>
        <p className="text-[10px] text-muted-foreground/60">
          v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
        </p>
      </div>
    </aside>
  );
}
