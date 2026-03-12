"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

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

  return (
    <aside className="w-64 border-r border-[#ebe9f1] bg-white flex-shrink-0 sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#ebe9f1]">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#009688]" />}
          <h2 className="font-semibold text-[#5e5873]">{title}</h2>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="p-2 space-y-0.5 flex-1">{children}</nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#ebe9f1] text-center space-y-1">
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
