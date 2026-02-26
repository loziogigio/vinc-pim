"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import {
  BarChart3,
  FileText,
  PlusCircle,
  Settings,
  Layout,
} from "lucide-react";

export function DocumentsNavigation() {
  return (
    <AppSidebar title="Documents" icon={FileText}>
      <NavLink
        href="/b2b/documents"
        icon={BarChart3}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/documents/list"
        icon={FileText}
        label="Tutti i Documenti"
      />
      <NavLink
        href="/b2b/documents/create"
        icon={PlusCircle}
        label="Nuovo Documento"
      />
      <NavLink
        href="/b2b/documents/settings"
        icon={Settings}
        label="Impostazioni"
      />
      <NavLink
        href="/b2b/documents/templates"
        icon={Layout}
        label="Template"
      />
    </AppSidebar>
  );
}
