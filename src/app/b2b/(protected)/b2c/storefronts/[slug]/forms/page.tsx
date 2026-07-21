"use client";

import { use } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CmsAdminProvider, FormsScreen, type FormsTab } from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";

export default function FormsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const adapter = useCsCmsAdapter(slug, tenantPrefix);

  const tab: FormsTab =
    searchParams.get("tab") === "definitions" ? "definitions" : "submissions";

  const handleTabChange = (nextTab: FormsTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: t("nav.b2c.forms") },
        ]}
      />

      <CmsAdminProvider adapter={adapter}>
        <FormsScreen tab={tab} onTabChange={handleTabChange} storefrontLabel={slug} />
      </CmsAdminProvider>
    </div>
  );
}
