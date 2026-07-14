"use client";

import { Rss } from "lucide-react";
import { AppSidebar, NavLink } from "@/components/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Sidebar navigation for the Channel Feeds module.
 *
 * Only one entry today (Destinations) — later phases (per-destination run
 * history, item errors, etc.) live under /b2b/feeds/destinations/*, so this
 * single link is intentionally left without `exactMatch` to stay highlighted
 * across the whole module tree.
 */
export function FeedsNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("pages.feeds.title")}>
      <NavLink
        href="/b2b/feeds"
        icon={Rss}
        label={t("pages.feeds.destinations")}
      />
    </AppSidebar>
  );
}
