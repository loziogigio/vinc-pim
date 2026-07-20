"use client";

import { use } from "react";
import { usePathname } from "next/navigation";
import { CmsAdminProvider } from "vinc-cms-admin/react";
import { PagesListScreen } from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";

export default function PagesManagementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const adapter = useCsCmsAdapter(slug, tenantPrefix);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: t("pages.b2c.pagesManagement.title") },
        ]}
      />
      <CmsAdminProvider adapter={adapter}>
        <PagesListScreen storefrontLabel={slug} />
      </CmsAdminProvider>
    </div>
  );
}
