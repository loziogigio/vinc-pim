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

export function AdminNavigation() {
  return (
    <AppSidebar title="Admin">
      <NavLink
        href="/b2b/admin"
        icon={LayoutDashboard}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/admin/sessions"
        icon={Monitor}
        label="Sessioni"
      />
      <NavLink
        href="/b2b/admin/login-attempts"
        icon={History}
        label="Login Attempts"
      />
      <NavLink
        href="/b2b/admin/security"
        icon={ShieldCheck}
        label="Sicurezza"
      />
      <NavLink
        href="/b2b/admin/blocked-ips"
        icon={Ban}
        label="IP Bloccati"
      />
      <NavLink
        href="/b2b/admin/channels"
        icon={Radio}
        label="Canali"
      />
    </AppSidebar>
  );
}
