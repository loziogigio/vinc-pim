"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Send, FileText, History, Settings, Puzzle } from "lucide-react";

export function NotificationsNavigation() {
  return (
    <AppSidebar title="Notifications">
      <NavLink
        href="/b2b/notifications"
        icon={LayoutDashboard}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/notifications/campaigns"
        icon={Send}
        label="Campaigns"
      />
      <NavLink
        href="/b2b/notifications/templates"
        icon={FileText}
        label="Templates"
      />
      <NavLink
        href="/b2b/notifications/logs"
        icon={History}
        label="Logs"
      />
      <NavLink
        href="/b2b/notifications/components"
        icon={Puzzle}
        label="Components"
      />
      <NavLink
        href="/b2b/notifications/settings"
        icon={Settings}
        label="Settings"
      />
    </AppSidebar>
  );
}
