"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import { Newspaper, FileText, FolderTree, Tags } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function BlogNavigation() {
  const { t } = useTranslation();
  return (
    <AppSidebar title={t("nav.blog.title")} icon={Newspaper}>
      <NavLink href="/b2b/blog" icon={FileText} label={t("nav.blog.posts")} exactMatch />
      <NavLink href="/b2b/blog/categories" icon={FolderTree} label={t("nav.blog.categories")} />
      <NavLink href="/b2b/blog/tags" icon={Tags} label={t("nav.blog.tags")} />
    </AppSidebar>
  );
}
