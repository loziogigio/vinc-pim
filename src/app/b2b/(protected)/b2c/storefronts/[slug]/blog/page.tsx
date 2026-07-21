"use client";

import { use, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { CmsAdminProvider, BlogScreen } from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";

export default function StorefrontBlogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const basePath = `/b2b/b2c/storefronts/${slug}/blog`;

  const languages = useLanguageStore((s) => s.languages);
  const isLoadingLanguages = useLanguageStore((s) => s.isLoading);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const enabledLanguages = useMemo(
    () => languages.filter((l) => l.isEnabled),
    [languages],
  );
  useEffect(() => {
    if (languages.length === 0 && !isLoadingLanguages) fetchLanguages();
  }, [languages.length, isLoadingLanguages, fetchLanguages]);

  const base = useCsCmsAdapter(slug, tenantPrefix);
  const adapter = useMemo(
    () => ({
      ...base,
      locales: enabledLanguages.length
        ? enabledLanguages.map((l) => ({ code: l.code, name: l.nativeName }))
        : [{ code: "it" }],
      links: {
        ...base.links,
        blogBuilder: (postId: string, locale: string) =>
          `${tenantPrefix}/b2b/blog-builder?post=${postId}&locale=${locale}&back=${encodeURIComponent(basePath)}`,
        blogList: `${tenantPrefix}${basePath}`,
      },
    }),
    [base, enabledLanguages, tenantPrefix, basePath],
  );

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: t("nav.b2c.blog") },
        ]}
      />

      <CmsAdminProvider adapter={adapter}>
        <BlogScreen storefrontLabel={slug} />
      </CmsAdminProvider>
    </div>
  );
}
