"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function B2BPortalNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.b2bPortal.title")}>
      <NavLink
        href="/b2b/b2b"
        icon={LayoutDashboard}
        label={t("nav.b2bPortal.portals")}
        exactMatch
      />
      <NavLink
        href="/b2b/b2b/settings"
        icon={Settings}
        label={t("nav.b2bPortal.settings")}
      />
    </AppSidebar>
  );
}
