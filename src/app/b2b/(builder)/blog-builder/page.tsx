"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { CmsAdminClient } from "vinc-cms-admin";
import { CmsAdminProvider, BlogBuilderScreen } from "vinc-cms-admin/react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { useCsCmsAdapter } from "@/lib/cms-admin/cs-adapter";

export const dynamic = "force-dynamic";

// A blog post's builder is reached both from a B2C storefront's blog list
// (`back` = `/b2b/b2c/storefronts/{slug}/blog`) and from the tenant-level blog
// mount (`back` = `/b2b/blog`, src/components/blog/*, kept unconverted). Only the
// storefront flow gets a storefront-scoped client (matching Task 5's wrapper
// routes); the tenant flow falls back to the tenant-wide `/api/b2b` blog API,
// exactly like the pre-package builder page did.
const STOREFRONT_BACK_RE = /\/b2c\/storefronts\/([^/]+)\/blog(?:$|[/?])/;

function BlogBuilderContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "";
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const postId = searchParams.get("post");
  const back = searchParams.get("back") || "/b2b/blog";
  const storefrontSlug = useMemo(() => STOREFRONT_BACK_RE.exec(back)?.[1] ?? "", [back]);

  const allLanguages = useLanguageStore((s) => s.languages);
  const isLoadingLanguages = useLanguageStore((s) => s.isLoading);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const enabledLanguages = useMemo(() => allLanguages.filter((l) => l.isEnabled), [allLanguages]);
  const defaultLang = enabledLanguages.find((l) => l.isDefault)?.code || enabledLanguages[0]?.code || "it";

  const [locale, setLocale] = useState(searchParams.get("locale") || "");

  // Load enabled languages on mount, then default the locale once they arrive.
  useEffect(() => {
    if (allLanguages.length === 0 && !isLoadingLanguages) {
      fetchLanguages();
    }
  }, [allLanguages.length, isLoadingLanguages, fetchLanguages]);

  useEffect(() => {
    if (!locale && defaultLang) setLocale(defaultLang);
  }, [defaultLang, locale]);

  function handleLocaleChange(next: string) {
    setLocale(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("locale", next);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  // Storefront-scoped calls always need a real slug for useCsCmsAdapter (its
  // client apiBase is `/api/b2b/b2c/storefronts/{slug}`); pass a harmless
  // placeholder when there is none so the hook never fetches storefront/undefined.
  const base = useCsCmsAdapter(storefrontSlug || "_tenant", tenantPrefix);
  const adapter = useMemo(() => {
    const links = { ...base.links, blogList: `${tenantPrefix}${back}` };
    if (storefrontSlug) return { ...base, links };
    return {
      ...base,
      client: new CmsAdminClient({ apiBase: "/api/b2b" }),
      previewUrl: () => undefined,
      links,
    };
  }, [base, storefrontSlug, tenantPrefix, back]);

  if (!postId) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center text-center">
        <div>
          <p className="text-[#5e5873] font-medium">{t("pages.blog.builder.missingParams")}</p>
          <Link href={`${tenantPrefix}${back}`} className="mt-2 inline-block text-sm text-[#009688] hover:underline">
            {t("pages.blog.builder.back")}
          </Link>
        </div>
      </div>
    );
  }

  if (!locale) {
    return <div className="flex h-[calc(100vh-64px)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#009688]" /></div>;
  }

  return (
    <CmsAdminProvider adapter={adapter}>
      <div className="flex h-10 items-center justify-end gap-2 border-b border-[#ebe9f1] bg-white px-6">
        <label className="flex items-center gap-2 text-sm text-[#6e6b7b]">
          {t("pages.blog.builder.language")}:
          <select value={locale} onChange={(e) => handleLocaleChange(e.target.value)}
            className="h-8 rounded-lg border border-[#ebe9f1] px-2 text-sm">
            {enabledLanguages.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
          </select>
        </label>
      </div>
      <BlogBuilderScreen postId={postId} locale={locale} />
    </CmsAdminProvider>
  );
}

export default function BlogBuilderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <BlogBuilderContent />
    </Suspense>
  );
}
