"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Smartphone,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Save,
  ChevronLeft,
  ChevronRight,
  History,
  Tablet,
  Upload
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Public_Sans } from "next/font/google";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { VersionHistory } from "@/components/builder/VersionHistory";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { usePageBuilderStore, type DeviceMode } from "@/lib/store/pageBuilderStore";
import type { PageConfig } from "@/lib/types/blocks";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const fetchPageConfig = async (slug: string) => {
  const response = await fetch(`/api/pages/${slug}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load page configuration");
  }
  return (await response.json()) as PageConfig;
};

export default function PageBuilderPage() {
  const router = useRouter();

  const blocks = usePageBuilderStore((state) => state.blocks);
  const isDirty = usePageBuilderStore((state) => state.isDirty);
  const history = usePageBuilderStore((state) => state.history);
  const loadPageConfig = usePageBuilderStore((state) => state.loadPageConfig);
  const markSaved = usePageBuilderStore((state) => state.markSaved);
  const getPagePayload = usePageBuilderStore((state) => state.getPagePayload);
  const undo = usePageBuilderStore((state) => state.undo);
  const redo = usePageBuilderStore((state) => state.redo);
  const selectBlock = usePageBuilderStore((state) => state.selectBlock);
  const selectedBlockId = usePageBuilderStore((state) => state.selectedBlockId);

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [splitView, setSplitView] = useState(true);
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isHotfixing, setIsHotfixing] = useState(false);

  const versions = usePageBuilderStore((state) => state.versions);
  const currentVersion = usePageBuilderStore((state) => state.currentVersion);
  const currentPublishedVersion = usePageBuilderStore((state) => state.currentPublishedVersion);

  const isEditingPublishedVersion = currentVersion === currentPublishedVersion;

  useEffect(() => {
    fetchPageConfig("home")
      .then((config) => {
        console.log("Loaded config:", config);
        console.log("Versions:", config.versions);
        loadPageConfig(config);
      })
      .catch((loadError) => {
        console.error(loadError);
        setError("Failed to load page configuration");
      })
      .finally(() => setIsLoading(false));
  }, [loadPageConfig]);

  useEffect(() => {
    if (selectedBlockId) {
      setIsSettingsOpen(true);
    }
  }, [selectedBlockId]);

  const closeSettings = () => {
    setIsSettingsOpen(false);
    selectBlock(null);
  };

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const handleSelectTab = (tab: "builder" | "preview") => {
    setActiveTab(tab);
    if (tab === "preview") {
      setSplitView(false);
    }
  };

  const toggleSplitView = () => {
    setSplitView((previous) => {
      const next = !previous;
      if (next) {
        setActiveTab("builder");
      }
      return next;
    });
  };

  const iconButtonClass =
    "flex h-[38px] w-[38px] items-center justify-center rounded-[5px] border-0 bg-transparent text-[#6e6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]";
  const disabledIconButtonClass = "cursor-not-allowed text-[#d8d6de] hover:bg-transparent hover:text-[#d8d6de]";
  const shouldShowCanvas = splitView || (!splitView && activeTab === "builder");
  const shouldShowPreview = splitView || (!splitView && activeTab === "preview");

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = getPagePayload();
      const response = await fetch("/api/pages/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      const saved = await response.json();
      loadPageConfig(saved); // Reload to sync versions
      markSaved();

      const currentVersionData = saved.versions[saved.versions.length - 1];
      const statusLabel = currentVersionData?.status === "published" ? "published" : "draft";
      setInfo(`Version ${saved.currentVersion} (${statusLabel}) saved successfully.`);
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // const handleReset = async () => {
  //   setIsResetting(true);
  //   setError(null);
  //   setInfo(null);
  //   try {
  //     const config = await fetchPageConfig("home");
  //     loadPageConfig(config);
  //     await fetch("/api/pages/preview?slug=home", { method: "DELETE" });
  //   } catch (resetError) {
  //     console.error(resetError);
  //     setError("Unable to reset. Please refresh the page.");
  //   } finally {
  //     setIsResetting(false);
  //   }
  // };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  const handlePreview = async () => {
    if (blocks.length === 0) {
      setError("Add at least one block to preview the page.");
      return;
    }

    setError(null);
    setInfo(null);
    try {
      const state = usePageBuilderStore.getState();

      // Build preview payload with current state in proper format
      // If no versions exist yet, create a minimal version 1 structure
      const currentVersionData = state.versions.length > 0
        ? state.versions[state.versions.length - 1]
        : null;

      const nowISO = new Date().toISOString();

      const previewVersion = {
        version: currentVersionData?.version || 1,
        blocks: state.blocks.map((block, index) => ({
          ...block,
          order: index
        })),
        seo: state.pageDetails.seo,
        status: (currentVersionData?.status || "draft") as "draft" | "published",
        createdAt: currentVersionData?.createdAt || nowISO,
        lastSavedAt: nowISO,
        publishedAt: currentVersionData?.publishedAt,
        createdBy: currentVersionData?.createdBy || "admin",
        comment: currentVersionData?.comment || "Preview version"
      };

      const previewPayload: PageConfig = {
        slug: "home",
        name: "Homepage",
        versions: currentVersionData
          ? [...state.versions.slice(0, -1), previewVersion]
          : [previewVersion],
        currentVersion: state.currentVersion || 1,
        currentPublishedVersion: state.currentPublishedVersion,
        createdAt: state.pageDetails.createdAt || nowISO,
        updatedAt: nowISO
      };

      const response = await fetch("/api/pages/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Preview validation failed:", errorData);
        throw new Error(errorData.error || "Failed to publish preview");
      }

      const previewUrl = `/preview?slug=home`;
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (previewError) {
      console.error(previewError);
      setError("Unable to open preview. Please try again.");
    }
  };

  const handleHotfix = async () => {
    setIsHotfixing(true);
    setError(null);
    setInfo(null);
    try {
      const payload = getPagePayload();
      const response = await fetch("/api/pages/hotfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to apply hotfix");
      }

      const updated = await response.json();
      loadPageConfig(updated); // Reload to sync versions
      markSaved();
      setInfo(`Hot fix applied to Version ${currentVersion}! Changes are live.`);
    } catch (hotfixError) {
      console.error(hotfixError);
      setError("Unable to apply hotfix. Please try again.");
    } finally {
      setIsHotfixing(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/pages/publish-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "home" })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to publish");
      }

      const updated = await response.json();
      loadPageConfig(updated); // Reload to sync versions
      setInfo(`Version ${updated.currentPublishedVersion} published successfully!`);
    } catch (publishError) {
      console.error(publishError);
      setError("Unable to publish. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLoadVersion = async (version: number) => {
    try {
      const response = await fetch("/api/pages/load-version-as-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "home", version })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load version");
      }

      const updated = await response.json();
      loadPageConfig(updated);
      setIsVersionHistoryOpen(false);
      setInfo(`Loaded version ${version}. Now editing as version ${updated.currentVersion}.`);
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load version. Please try again.");
    }
  };

  const handleStartNewVersion = async () => {
    try {
      const response = await fetch("/api/pages/start-new-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "home" })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start new version");
      }

      const updated = await response.json();
      loadPageConfig(updated);
      setInfo(`Started new version ${updated.currentVersion}`);
    } catch (startError) {
      console.error(startError);
      setError("Unable to start new version. Please try again.");
    }
  };

  const handleDeleteVersion = async (version: number) => {
    try {
      const response = await fetch("/api/pages/delete-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "home", version })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete version");
      }

      const updated = await response.json();
      loadPageConfig(updated); // Reload to sync
      setInfo(`Deleted version ${version}`);
    } catch (deleteError) {
      console.error(deleteError);
      const errorMessage =
        deleteError instanceof Error ? deleteError.message : "Unable to delete version. Please try again.";
      setError(errorMessage);
    }
  };

  const handleDuplicateVersion = async (version: number) => {
    try {
      const response = await fetch("/api/pages/duplicate-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "home", version })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to duplicate version");
      }

      const updated = await response.json();
      loadPageConfig(updated); // Reload to sync and switch to new version
      setIsVersionHistoryOpen(false);
      setInfo(`Duplicated version ${version} as version ${updated.currentVersion}`);
    } catch (duplicateError) {
      console.error(duplicateError);
      const errorMessage =
        duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate version. Please try again.";
      setError(errorMessage);
    }
  };

  const autosaveMessage = useMemo(() => {
    if (isSaving) return "Saving changes…";
    if (isDirty) return "Unsaved edits — remember to save.";
    return "All changes saved to MongoDB";
  }, [isDirty, isSaving]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7fa]">
        <div className="flex items-center gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-6 py-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
          <Loader2 className="h-5 w-5 animate-spin text-[#009688]" />
          <span className="text-[0.857rem] font-medium text-[#5e5873]">Loading builder…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(publicSans.className, "flex h-screen flex-col bg-[#f8f7fa] text-[#5e5873]")}>
      <header className="flex h-[64px] items-center bg-white px-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className={cn(iconButtonClass, sidebarCollapsed && "border border-[#ebe9f1]")}
            aria-label="Toggle block library"
          >
            {sidebarCollapsed ? <ChevronRight className="h-[1.1rem] w-[1.1rem]" /> : <Menu className="h-[1.1rem] w-[1.1rem]" />}
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[1rem] font-semibold text-[#5e5873]">VIC Store</span>
              <span className="text-[0.857rem] text-[#b9b9c3]">Homepage Builder</span>
              {currentVersion > 0 ? (
                <>
                  <span
                    className={cn(
                      "rounded-[0.358rem] px-[0.714rem] py-[0.286rem] text-[0.786rem] font-semibold",
                      isEditingPublishedVersion
                        ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]"
                        : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"
                    )}
                  >
                    {isEditingPublishedVersion ? "✓ Published" : "Draft"} · v{currentVersion}
                  </span>
                  {currentPublishedVersion && currentPublishedVersion !== currentVersion ? (
                    <span className="text-[0.786rem] text-[#b9b9c3]">latest published: v{currentPublishedVersion}</span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className={cn(iconButtonClass, !canUndo && disabledIconButtonClass)}
            aria-label="Undo"
          >
            <RotateCcw className="h-[1.1rem] w-[1.1rem]" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className={cn(iconButtonClass, !canRedo && disabledIconButtonClass)}
            aria-label="Redo"
          >
            <RotateCw className="h-[1.1rem] w-[1.1rem]" />
          </button>

          <div className="flex items-center gap-[0.25rem] rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] p-1">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn(
                "flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition",
                device === "desktop"
                  ? "bg-[#009688] text-white shadow"
                  : "text-[#5e5873] hover:bg-white"
              )}
              aria-label="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("tablet")}
              className={cn(
                "flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition",
                device === "tablet"
                  ? "bg-[#009688] text-white shadow"
                  : "text-[#5e5873] hover:bg-white"
              )}
              aria-label="Tablet preview"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn(
                "flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition",
                device === "mobile"
                  ? "bg-[#009688] text-white shadow"
                  : "text-[#5e5873] hover:bg-white"
              )}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "flex items-center gap-2 rounded-[0.358rem] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium transition",
              splitView
                ? "border border-transparent bg-[rgba(255,152,0,0.12)] text-[#e65100]"
                : "border border-[#ebe9f1] bg-[#fafafc] text-[#5e5873] hover:bg-white"
            )}
            onClick={toggleSplitView}
          >
            {splitView ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Split View
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
            onClick={() => {
              console.log("Opening version history, versions:", versions);
              console.log("Current version:", currentVersion);
              console.log("Current published version:", currentPublishedVersion);
              setIsVersionHistoryOpen(true);
            }}
          >
            <History className="h-4 w-4" />
            History
          </Button>

          {!isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] transition hover:bg-[#00796b]"
              onClick={handleSave}
              disabled={isSaving || !isDirty || blocks.length === 0}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}

          {isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-gradient-to-tr from-[#ff5722] to-[rgba(255,87,34,0.7)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(255,87,34,0.4)] transition hover:from-[#f4511e] hover:to-[rgba(244,81,30,0.7)]"
              onClick={handleHotfix}
              disabled={isHotfixing || !isDirty || blocks.length === 0}
              title="Update published version directly without creating a new version"
            >
              {isHotfixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Hot Fix
            </Button>
          )}

          {!isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] transition hover:bg-[#00796b]"
              onClick={handlePublish}
              disabled={isPublishing}
              title="Publish the current draft version"
            >
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
            onClick={handleStartNewVersion}
            title="Start a new version from scratch"
          >
            <RefreshCcw className="h-4 w-4" />
            New Version
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600">{error}</div>
      ) : null}
      {info ? (
        <div className="border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]">
          {info}
        </div>
      ) : null}
      {currentVersion === currentPublishedVersion && !isDirty ? (
        <div className="border-l-4 border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-6 py-3 text-[0.857rem] text-[#1976d2]">
          <strong>Viewing published version {currentVersion}.</strong> Make changes and click <strong>Hot Fix</strong> to update this version directly, or click <strong>New Version</strong> to create a new draft.
        </div>
      ) : null}

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
              sidebarCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
            )}
          >
            {!sidebarCollapsed ? (
              <div className="border-b border-[#ebe9f1] px-2 py-3">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="flex w-full items-center justify-center rounded-[5px] border border-[#ebe9f1] bg-white py-2 text-[#6e6b7b] transition hover:bg-[#fafafc]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <BlockLibrary />
          </div>
        </aside>

        <div className="flex flex-1 min-w-0 overflow-hidden">
          {shouldShowCanvas ? (
            <section
              className={cn(
                "flex h-full w-full flex-col border-r border-[#ebe9f1] bg-[#e8eaed] transition-all duration-300",
                splitView ? "lg:w-[285px] lg:min-w-[260px]" : "lg:w-full"
              )}
            >
              <Canvas
                isSplitView={splitView}
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                device={device}
                onOpenSettings={() => {
                  setIsSettingsOpen(true);
                }}
              />
            </section>
          ) : null}

          {shouldShowPreview ? (
            <section className="flex flex-1 flex-col bg-[#e8eaed] px-6 py-6">
              <LivePreview device={device} blocks={blocks} isDirty={isDirty} />
            </section>
          ) : null}
        </div>
      </main>

      <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-3 text-[0.857rem] text-[#5e5873] shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#009688]" />
        <span>{autosaveMessage}</span>
      </div>

      <BlockSettingsModal open={isSettingsOpen} onClose={closeSettings} />

      {isVersionHistoryOpen && (
        <VersionHistory
          versions={versions}
          currentVersion={currentVersion}
          currentPublishedVersion={currentPublishedVersion}
          isDirty={isDirty}
          onLoadVersion={handleLoadVersion}
          onDelete={handleDeleteVersion}
          onDuplicate={handleDuplicateVersion}
          onClose={() => setIsVersionHistoryOpen(false)}
        />
      )}
    </div>
  );
}
