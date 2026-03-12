"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Send, FileText, History, Settings, Puzzle, Smartphone } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function NotificationsNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.notifications.title")}>
      <NavLink
        href="/b2b/notifications"
        icon={LayoutDashboard}
        label={t("nav.notifications.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/notifications/campaigns"
        icon={Send}
        label={t("nav.notifications.campaigns")}
      />
      <NavLink
        href="/b2b/notifications/templates"
        icon={FileText}
        label={t("nav.notifications.templates")}
      />
      <NavLink
        href="/b2b/notifications/logs"
        icon={History}
        label={t("nav.notifications.logs")}
      />
      <NavLink
        href="/b2b/notifications/devices"
        icon={Smartphone}
        label={t("nav.notifications.devices")}
      />
      <NavLink
        href="/b2b/notifications/components"
        icon={Puzzle}
        label={t("nav.notifications.components")}
      />
      <NavLink
        href="/b2b/notifications/settings"
        icon={Settings}
        label={t("nav.notifications.settings")}
      />
    </AppSidebar>
  );
}
