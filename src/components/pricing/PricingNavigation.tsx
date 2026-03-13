"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Settings, ScrollText, DollarSign } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function PricingNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.pricing.title")} icon={DollarSign}>
      <NavLink
        href="/b2b/pricing"
        icon={LayoutDashboard}
        label={t("nav.pricing.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/pricing/settings"
        icon={Settings}
        label={t("nav.pricing.settings")}
      />
      <NavLink
        href="/b2b/pricing/logs"
        icon={ScrollText}
        label={t("nav.pricing.logs")}
      />
    </AppSidebar>
  );
}
