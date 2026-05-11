"use client";

/**
 * B2B Page Builder — forked from src/app/b2b/(builder)/b2c-page-builder/page.tsx
 * for the B2B portal; scoped by `portal_slug` instead of `storefront_slug`.
 *
 * The portal slug comes from the `?portal=` query param (default "default");
 * the page slug comes from `?page=` (required). All page-template API calls go
 * to the Phase-3 portal routes:
 *   /api/b2b/b2b/portals/[slug]/pages/[pageSlug]/template/*
 * and the live-preview branding/domain comes from:
 *   GET /api/b2b/b2b/portals/[slug]   (raw IB2BPortal doc — .domains[]/.branding)
 *
 * The B2C /b2b/b2c-page-builder page and the /api/b2b/b2c/storefronts/* routes
 * are NOT touched — the two builders coexist.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Menu,
  Monitor,
  Smartphone,
  RotateCcw,
  RotateCw,
  Save,
  ChevronLeft,
  ChevronRight,
  Tablet,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  usePageBuilderStore,
  type DeviceMode,
} from "@/lib/store/pageBuilderStore";
import {
  b2bPageTemplateApi,
  b2bPortalDoc,
  DEFAULT_PORTAL_SLUG,
} from "./api";

export const dynamic = "force-dynamic";

/** Blocks available for custom pages */
const PAGE_BLOCKS = [
  "hero-full-width",
  "hero-split",
  "hero-with-widgets",
  "carousel-hero",
  "carousel-products",
  "carousel-gallery",
  "content-rich-text",
  "content-custom-html",
  "youtubeEmbed",
  "media-image",
  "form-contact",
];

/** Detects the Phase-1/3 409 NOT_MIGRATED write-gate response. */
const isNotMigratedResponse = (status: number, body: any) =>
  status === 409 && body?.code === "NOT_MIGRATED";

function B2BPageBuilderContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const portalSlug = searchParams.get("portal") || DEFAULT_PORTAL_SLUG;
  const pageSlug = searchParams.get("page") || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // API endpoints scoped to the portal + page. Built unconditionally so the
  // hook order is stable; the missing-`?page=` guard below short-circuits the
  // render before any of these URLs are used.
  const tmplApi = useMemo(
    () => b2bPageTemplateApi(portalSlug, pageSlug),
    [portalSlug, pageSlug]
  );
  const portalDocUrl = useMemo(() => b2bPortalDoc(portalSlug), [portalSlug]);
  const pagesHref = `${tenantPrefix}/b2b/b2b/portals/${portalSlug}/pages`;

  // Store bindings
  const blocks = usePageBuilderStore((s) => s.blocks);
  const isDirty = usePageBuilderStore((s) => s.isDirty);
  const history = usePageBuilderStore((s) => s.history);
  const loadPageConfig = usePageBuilderStore((s) => s.loadPageConfig);
  const markSaved = usePageBuilderStore((s) => s.markSaved);
  const getPagePayload = usePageBuilderStore((s) => s.getPagePayload);
  const undo = usePageBuilderStore((s) => s.undo);
  const redo = usePageBuilderStore((s) => s.redo);
  const selectBlock = usePageBuilderStore((s) => s.selectBlock);
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId);
  const currentVersion = usePageBuilderStore((s) => s.currentVersion);
  const currentPublishedVersion = usePageBuilderStore((s) => s.currentPublishedVersion);

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBuilderVisible, setIsBuilderVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Set when a write hits the Phase-1/3 409 NOT_MIGRATED gate. */
  const [notMigrated, setNotMigrated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | undefined>();

  const isPublished = currentPublishedVersion === currentVersion && currentPublishedVersion != null;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const autosaveMessage = useMemo(() => {
    if (isLoading) return t("common.loading");
    if (isSaving) return t("pages.b2bPageBuilder.savingChanges");
    if (isDirty) return t("pages.b2bPageBuilder.unsavedChanges");
    return t("pages.b2bPageBuilder.allChangesSaved");
  }, [isLoading, isSaving, isDirty, t]);

  /**
   * Reads & parses a write response. If it's the 409 NOT_MIGRATED gate,
   * flips the `notMigrated` flag and returns null so callers bail out.
   * Otherwise returns the parsed JSON; throws on any other non-OK status.
   */
  const handleWriteResponse = async (
    res: Response,
    fallbackError: string
  ): Promise<any | null> => {
    if (res.ok) {
      setNotMigrated(false);
      return res.json();
    }
    const data = await res.json().catch(() => ({ error: fallbackError }));
    if (isNotMigratedResponse(res.status, data)) {
      setNotMigrated(true);
      setError(null);
      return null;
    }
    throw new Error(data?.error || fallbackError);
  };

  // Load template on mount
  useEffect(() => {
    if (!pageSlug) {
      setIsLoading(false);
      return;
    }
    const loadTemplate = async () => {
      try {
        const res = await fetch(tmplApi.get, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load template");
        const config = await res.json();
        loadPageConfig(config);
      } catch (err) {
        console.error(err);
        setError("Failed to load page template");
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPageConfig, tmplApi.get, pageSlug]);

  // Fetch the portal's primary domain for the live-preview iframe.
  // The portal GET returns the raw portal document (not wrapped in { data }).
  useEffect(() => {
    const fetchPortalDomain = async () => {
      try {
        const res = await fetch(portalDocUrl);
        if (!res.ok) return;
        const portal = await res.json();
        const domains: { domain: string; is_primary?: boolean }[] =
          portal?.domains ?? [];
        if (domains.length > 0) {
          const primary = domains.find((d) => d.is_primary) || domains[0];
          const raw = primary.domain;
          setPortalUrl(raw.startsWith("http") ? raw : `https://${raw}`);
        }
      } catch (err) {
        console.warn("Failed to fetch portal domain for preview:", err);
      }
    };
    fetchPortalDomain();
  }, [portalDocUrl]);

  useEffect(() => {
    if (selectedBlockId) setIsSettingsOpen(true);
  }, [selectedBlockId]);

  const closeSettings = () => {
    setIsSettingsOpen(false);
    selectBlock(null);
  };

  // ============================================
  // API handlers (portal + page scoped)
  // ============================================

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = getPagePayload();
      const res = await fetch(tmplApi.saveDraft, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
      });
      const saved = await handleWriteResponse(res, "Failed to save");
      if (!saved) return;
      loadPageConfig(saved);
      markSaved();
      setInfo(t("pages.b2bPageBuilder.draftSaved"));
    } catch (e) {
      console.error(e);
      setError("Unable to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);
    setInfo(null);
    try {
      // Save first if there are unsaved changes
      if (isDirty) {
        const payload = getPagePayload();
        const saveRes = await fetch(tmplApi.saveDraft, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
        });
        const saved = await handleWriteResponse(
          saveRes,
          "Failed to save before publishing"
        );
        if (!saved) return;
      }

      const res = await fetch(tmplApi.publish, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const updated = await handleWriteResponse(res, "Failed to publish");
      if (!updated) return;
      loadPageConfig(updated);
      markSaved();
      setInfo(t("pages.b2bPageBuilder.publishSuccess"));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to publish.");
    } finally {
      setIsPublishing(false);
    }
  };

  const iconButtonClass =
    "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]";
  const disabledIconButtonClass =
    "cursor-not-allowed opacity-30 hover:bg-transparent";

  const toggleBuilderPanel = () => setIsBuilderVisible((prev) => !prev);

  // Guard: the page builder genuinely needs a `?page=` slug (the `?portal=`
  // one has a default, so it is never missing). Placed after all hooks so the
  // hook order stays stable across renders.
  if (!pageSlug) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#5e5873] font-medium">
            {t("pages.b2bPageBuilder.missingPageParam")}
          </p>
          <Link
            href={pagesHref}
            className="mt-2 inline-block text-sm text-[#009688] hover:underline"
          >
            {t("pages.b2bPageBuilder.backToPages")}
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Toolbar */}
      <div className="flex h-[56px] items-center border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-4">
          <Link
            href={pagesHref}
            className="flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]"
            title={t("pages.b2bPageBuilder.backToPages")}
          >
            <ArrowLeft className="h-[1.1rem] w-[1.1rem]" />
          </Link>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className={cn(
              iconButtonClass,
              sidebarCollapsed && "border border-[#ebe9f1]"
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-[1.1rem] w-[1.1rem]" />
            ) : (
              <Menu className="h-[1.1rem] w-[1.1rem]" />
            )}
          </button>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[1rem] font-semibold text-[#5e5873]">
                {t("pages.b2bPageBuilder.title")}
              </span>
              <span className="rounded bg-[rgba(0,150,136,0.12)] px-2 py-0.5 text-xs font-medium text-[#00796b]">
                {portalSlug}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                /{pageSlug}
              </span>
              <span
                className={cn(
                  "rounded-[0.358rem] px-[0.714rem] py-[0.286rem] text-[0.786rem] font-semibold",
                  isPublished
                    ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]"
                    : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"
                )}
              >
                {isPublished ? t("common.published") : t("common.draft")}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className={cn(iconButtonClass, !canUndo && disabledIconButtonClass)}
          >
            <RotateCcw className="h-[1.1rem] w-[1.1rem]" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className={cn(iconButtonClass, !canRedo && disabledIconButtonClass)}
          >
            <RotateCw className="h-[1.1rem] w-[1.1rem]" />
          </button>

          {/* Device selector */}
          <div className="flex items-center gap-[0.25rem] rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] p-1">
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const
            ).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDevice(mode)}
                className={cn(
                  "flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition",
                  device === mode
                    ? "bg-[#009688] text-white shadow"
                    : "text-[#5e5873] hover:bg-white"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "flex items-center gap-2 rounded-[0.358rem] border px-[1rem] py-[0.571rem] text-[0.95rem] font-medium transition",
              isBuilderVisible
                ? "border-[#ebe9f1] bg-white text-[#5e5873] shadow-sm"
                : "border-[#ebe9f1] bg-[#fafafc] text-[#5e5873] hover:bg-white"
            )}
            onClick={toggleBuilderPanel}
          >
            {isBuilderVisible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            {t("pages.b2bPageBuilder.blockBuilder")}
          </Button>

          <Button
            type="button"
            className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]"
            onClick={handleSave}
            disabled={isSaving || !isDirty || blocks.length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("pages.b2bPageBuilder.saveDraft")}
          </Button>

          <Button
            type="button"
            className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]"
            onClick={handlePublish}
            disabled={isPublishing || blocks.length === 0}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("common.publish")}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {notMigrated && (
        <div className="border-l-4 border-amber-500 bg-amber-50 px-6 py-3 text-[0.857rem]">
          <p className="font-medium text-amber-800">
            {t("errors.b2bPortal.notMigrated")}
          </p>
          <p className="mt-1 text-amber-700">
            {t("pages.b2bPortal.notMigratedHint")}
          </p>
        </div>
      )}
      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600">
          {error}
        </div>
      )}
      {info && (
        <div className="border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]">
          {info}
        </div>
      )}

      {/* Main builder area */}
      <main className="flex flex-1 overflow-hidden bg-[#e8eaed]">
        <aside
          className={cn(
            "h-full overflow-hidden border-r border-[#ebe9f1] bg-white transition-all duration-300",
            sidebarCollapsed ? "w-0" : "w-[100px]"
          )}
        >
          <div
            className={cn(
              "flex h-full flex-col",
              sidebarCollapsed
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            )}
          >
            {!sidebarCollapsed && (
              <div className="border-b border-[#ebe9f1] px-2 py-3">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="flex w-full items-center justify-center rounded-[5px] border border-[#ebe9f1] bg-white py-2 text-[#6e6b7b] hover:bg-[#fafafc]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}
            <BlockLibrary allowedBlockIds={PAGE_BLOCKS} />
          </div>
        </aside>

        <div className="flex flex-1 min-w-0 overflow-hidden">
          <section
            className={cn(
              "flex h-full flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed] transition-all duration-300",
              isBuilderVisible
                ? "w-[360px] min-w-[320px]"
                : "w-[60px] min-w-[60px]"
            )}
          >
            <Canvas
              onOpenSettings={() => setIsSettingsOpen(true)}
              isVisible={isBuilderVisible}
              onToggleVisibility={toggleBuilderPanel}
              device={device}
            />
          </section>

          <section className="flex flex-1 flex-col bg-[#e8eaed] px-6 py-6">
            <LivePreview
              device={device}
              blocks={blocks}
              pageType="home"
              pageSlug={pageSlug}
              customerWebUrl={portalUrl}
              isDirty={isDirty}
            />
          </section>
        </div>
      </main>

      {/* Status bar */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-3 text-[0.857rem] text-[#5e5873] shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#009688]" />
        <span>{autosaveMessage}</span>
      </div>

      <BlockSettingsModal open={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default function B2BPageBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <B2BPageBuilderContent />
    </Suspense>
  );
}
