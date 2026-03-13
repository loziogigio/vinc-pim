"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import {
  LayoutDashboard,
  Monitor,
  History,
  ShieldCheck,
  Ban,
  Radio,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function AdminNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.admin.title")}>
      <NavLink
        href="/b2b/admin"
        icon={LayoutDashboard}
        label={t("nav.admin.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/admin/sessions"
        icon={Monitor}
        label={t("nav.admin.sessions")}
      />
      <NavLink
        href="/b2b/admin/login-attempts"
        icon={History}
        label={t("nav.admin.loginAttempts")}
      />
      <NavLink
        href="/b2b/admin/security"
        icon={ShieldCheck}
        label={t("nav.admin.security")}
      />
      <NavLink
        href="/b2b/admin/blocked-ips"
        icon={Ban}
        label={t("nav.admin.blockedIPs")}
      />
      <NavLink
        href="/b2b/admin/channels"
        icon={Radio}
        label={t("nav.admin.channels")}
      />
    </AppSidebar>
  );
}
