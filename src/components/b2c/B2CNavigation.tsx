"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { LayoutDashboard, Store, Settings } from "lucide-react";

export function B2CNavigation() {
  return (
    <AppSidebar title="B2C Storefront">
      <NavLink
        href="/b2b/b2c"
        icon={LayoutDashboard}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/b2c/storefronts"
        icon={Store}
        label="Storefronts"
      />
      <NavLink
        href="/b2b/b2c/settings"
        icon={Settings}
        label="Settings"
      />
    </AppSidebar>
  );
}
