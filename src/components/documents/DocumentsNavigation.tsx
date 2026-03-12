"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import {
  BarChart3,
  FileText,
  PlusCircle,
  Settings,
  Layout,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function DocumentsNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.documents.title")} icon={FileText}>
      <NavLink
        href="/b2b/documents"
        icon={BarChart3}
        label={t("nav.documents.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/documents/list"
        icon={FileText}
        label={t("nav.documents.allDocuments")}
      />
      <NavLink
        href="/b2b/documents/create"
        icon={PlusCircle}
        label={t("nav.documents.newDocument")}
      />
      <NavLink
        href="/b2b/documents/settings"
        icon={Settings}
        label={t("nav.documents.settings")}
      />
      <NavLink
        href="/b2b/documents/templates"
        icon={Layout}
        label={t("nav.documents.templates")}
      />
    </AppSidebar>
  );
}
