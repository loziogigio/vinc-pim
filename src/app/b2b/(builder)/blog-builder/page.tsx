"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Upload, ArrowLeft, Clock } from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { usePageBuilderStore, type DeviceMode } from "@/lib/store/pageBuilderStore";

export const dynamic = "force-dynamic";

/** Blocks available for blog posts (same content set as custom pages). */
const BLOG_BLOCKS = [
  "hero-full-width", "hero-split", "carousel-gallery",
  "content-rich-text", "content-custom-html", "youtubeEmbed", "media-image", "form-contact",
];

function BlogBuilderContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const allLanguages = useLanguageStore((s) => s.languages);
  const isLoadingLanguages = useLanguageStore((s) => s.isLoading);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const enabledLanguages = useMemo(() => allLanguages.filter((l) => l.isEnabled), [allLanguages]);
  const defaultLang = enabledLanguages.find((l) => l.isDefault)?.code || enabledLanguages[0]?.code || "it";

  const postId = searchParams.get("post");
  const back = searchParams.get("back") || "/b2b/blog";
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

  const apiBase = `/api/b2b/blog/posts/${postId}/content`;

  const blocks = usePageBuilderStore((s) => s.blocks);
  const isDirty = usePageBuilderStore((s) => s.isDirty);
  const loadPageConfig = usePageBuilderStore((s) => s.loadPageConfig);
  const markSaved = usePageBuilderStore((s) => s.markSaved);
  const getPagePayload = usePageBuilderStore((s) => s.getPagePayload);
  const selectBlock = usePageBuilderStore((s) => s.selectBlock);
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId);
  const currentVersion = usePageBuilderStore((s) => s.currentVersion);
  const currentPublishedVersion = usePageBuilderStore((s) => s.currentPublishedVersion);

  const [device] = useState<DeviceMode>("desktop");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  const isPublished = currentPublishedVersion === currentVersion && currentPublishedVersion != null;

  // (Re)load content whenever the locale changes
  useEffect(() => {
    if (!postId) { setIsLoading(false); return; }
    if (!locale) return;
    let active = true;
    setIsLoading(true);
    fetch(`${apiBase}?locale=${locale}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("load"); return r.json(); })
      .then((cfg) => { if (active) loadPageConfig(cfg); })
      .catch(() => { if (active) setError(t("pages.blog.builder.failedToSave")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [postId, locale, apiBase, loadPageConfig, t]);

  useEffect(() => { if (selectedBlockId) setIsSettingsOpen(true); }, [selectedBlockId]);

  const handleSave = async () => {
    setIsSaving(true); setError(null);
    try {
      const payload = getPagePayload();
      const res = await fetch(`${apiBase}/save-draft?locale=${locale}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
      });
      if (!res.ok) throw new Error("save");
      loadPageConfig(await res.json());
      markSaved();
      setInfo(t("pages.blog.builder.draftSaved"));
    } catch { setError(t("pages.blog.builder.failedToSave")); }
    finally { setIsSaving(false); }
  };

  const handlePublish = async () => {
    setIsPublishing(true); setError(null); setInfo(null);
    try {
      if (isDirty) {
        const payload = getPagePayload();
        await fetch(`${apiBase}/save-draft?locale=${locale}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
        });
      }
      const body = scheduleAt ? { scheduled_at: new Date(scheduleAt).toISOString() } : {};
      const res = await fetch(`${apiBase}/publish?locale=${locale}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("publish");
      loadPageConfig(await res.json());
      markSaved();
      setInfo(scheduleAt ? t("pages.blog.builder.scheduled") : t("pages.blog.builder.published"));
    } catch { setError(t("pages.blog.builder.failedToPublish")); }
    finally { setIsPublishing(false); }
  };

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

  if (isLoading) {
    return <div className="flex h-[calc(100vh-64px)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#009688]" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex h-[56px] items-center gap-4 border-b border-slate-200 bg-white px-6">
        <Link href={`${tenantPrefix}${back}`} title={t("pages.blog.builder.back")}
          className="flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc]">
          <ArrowLeft className="h-[1.1rem] w-[1.1rem]" />
        </Link>
        <span className="text-[1rem] font-semibold text-[#5e5873]">{t("pages.blog.builder.title")}</span>
        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold",
          isPublished ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]" : "bg-[rgba(255,152,0,0.12)] text-[#e65100]")}>
          {isPublished ? t("pages.blog.status.published") : t("pages.blog.status.draft")}
        </span>

        <label className="ml-2 flex items-center gap-2 text-sm text-[#6e6b7b]">
          {t("pages.blog.builder.language")}:
          <select value={locale} onChange={(e) => setLocale(e.target.value)}
            className="h-9 rounded-lg border border-[#ebe9f1] px-2 text-sm">
            {enabledLanguages.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[#6e6b7b]">
            <Clock className="h-3.5 w-3.5" />
            <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
              className="h-9 rounded-lg border border-[#ebe9f1] px-2 text-sm" title={t("pages.blog.builder.scheduleAt")} />
          </label>
          <Button onClick={handleSave} disabled={isSaving || !isDirty}
            className="flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("pages.blog.builder.saveDraft")}
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing || blocks.length === 0}
            className="flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]">
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {scheduleAt ? t("pages.blog.builder.schedule") : t("pages.blog.builder.publish")}
          </Button>
        </div>
      </div>

      {error && <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600">{error}</div>}
      {info && <div className="border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]">{info}</div>}

      <main className="flex flex-1 overflow-hidden bg-[#e8eaed]">
        <aside className="h-full w-[100px] overflow-hidden border-r border-[#ebe9f1] bg-white">
          <BlockLibrary allowedBlockIds={BLOG_BLOCKS} />
        </aside>
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <section className="flex h-full w-[360px] min-w-[320px] flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed]">
            <Canvas onOpenSettings={() => setIsSettingsOpen(true)} isVisible device={device} />
          </section>
          <section className="flex flex-1 flex-col bg-[#e8eaed] px-6 py-6">
            <LivePreview device={device} blocks={blocks} pageType="home" pageSlug={postId} isDirty={isDirty} />
          </section>
        </div>
      </main>

      <BlockSettingsModal open={isSettingsOpen} onClose={() => { setIsSettingsOpen(false); selectBlock(null); }} />
    </div>
  );
}

export default function BlogBuilderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <BlogBuilderContent />
    </Suspense>
  );
}
