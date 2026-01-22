"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
  return (
    <aside className="w-64 border-r border-[#ebe9f1] bg-white flex-shrink-0 sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-[#ebe9f1]">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#009688]" />}
          <h2 className="font-semibold text-[#5e5873]">{title}</h2>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="p-2 space-y-0.5">{children}</nav>
    </aside>
  );
}
