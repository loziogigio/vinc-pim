"use client";

import { PanelLeftOpen } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Floating button shown when a sidebar is collapsed (fully hidden). Clicking it
 * re-opens the sidebar. Fixed to the viewport just below the top bar so it sits
 * where the sidebar used to start.
 */
export function SidebarReopenButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const label = t("common.openSidebar");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed left-2 top-[72px] z-40 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <PanelLeftOpen className="h-5 w-5" />
    </button>
  );
}
