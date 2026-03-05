"use client";

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

export const dynamic = "force-dynamic";

/** Blocks available for custom pages */
const PAGE_BLOCKS = [
  "hero-full-width",
  "hero-split",
  "carousel-hero",
  "content-rich-text",
  "content-custom-html",
  "youtubeEmbed",
  "media-image",
  "form-contact",
];

function B2CPageBuilderContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const storefrontSlug = searchParams.get("storefront");
  const pageSlug = searchParams.get("page");
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const apiBase = `/api/b2b/b2c/storefronts/${storefrontSlug}/pages/${pageSlug}/template`;

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [storefrontUrl, setStorefrontUrl] = useState<string | undefined>();

  const isPublished = currentPublishedVersion === currentVersion && currentPublishedVersion != null;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const autosaveMessage = useMemo(() => {
    if (isLoading) return "Loading...";
    if (isSaving) return "Saving...";
    if (isDirty) return "Unsaved changes";
    return "All changes saved";
  }, [isLoading, isSaving, isDirty]);

  // Guards
  if (!storefrontSlug || !pageSlug) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#5e5873] font-medium">
            Missing storefront or page parameter
          </p>
          <Link
            href={`${tenantPrefix}/b2b/b2c`}
            className="mt-2 inline-block text-sm text-[#009688] hover:underline"
          >
            Back to B2C Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Load template on mount
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const res = await fetch(apiBase, { cache: "no-store" });
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
  }, [loadPageConfig, apiBase]);

  // Fetch storefront domain for live preview
  useEffect(() => {
    if (!storefrontSlug) return;
    const fetchDomain = async () => {
      try {
        const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}`);
        if (!res.ok) return;
        const { data } = await res.json();
        const domains: { domain: string; is_primary?: boolean }[] = data?.domains ?? [];
        if (domains.length > 0) {
          const primary = domains.find((d) => d.is_primary) || domains[0];
          const raw = primary.domain;
          setStorefrontUrl(raw.startsWith("http") ? raw : `https://${raw}`);
        }
      } catch (err) {
        console.warn("Failed to fetch storefront domain:", err);
      }
    };
    fetchDomain();
  }, [storefrontSlug]);

  useEffect(() => {
    if (selectedBlockId) setIsSettingsOpen(true);
  }, [selectedBlockId]);

  const closeSettings = () => {
    setIsSettingsOpen(false);
    selectBlock(null);
  };

  // ============================================
  // API handlers
  // ============================================

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = getPagePayload();
      const res = await fetch(`${apiBase}/save-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      const saved = await res.json();
      loadPageConfig(saved);
      markSaved();
      setInfo("Draft saved");
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
        const saveRes = await fetch(`${apiBase}/save-draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
        });
        if (!saveRes.ok) throw new Error("Failed to save before publishing");
      }

      const res = await fetch(`${apiBase}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to publish" }));
        throw new Error(data.error || "Failed to publish");
      }
      const updated = await res.json();
      loadPageConfig(updated);
      markSaved();
      setInfo("Page published successfully!");
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
            href={`${tenantPrefix}/b2b/b2c/storefronts/${storefrontSlug}/pages`}
            className="flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]"
            title="Back to Pages"
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
                Page Builder
              </span>
              <span className="rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                {storefrontSlug}
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
                {isPublished ? "Published" : "Draft"}
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
            Block Builder
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
            Save Draft
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
            Publish
          </Button>
        </div>
      </div>

      {/* Messages */}
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
              customerWebUrl={storefrontUrl}
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

export default function B2CPageBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <B2CPageBuilderContent />
    </Suspense>
  );
}
