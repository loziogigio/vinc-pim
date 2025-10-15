"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Save,
  Smartphone,
  Tablet,
  ChevronLeft,
  ChevronRight,
  History,
  Upload
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { VersionHistory } from "@/components/builder/VersionHistory";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { usePageBuilderStore, type DeviceMode } from "@/lib/store/pageBuilderStore";
import type { PageConfig } from "@/lib/types/blocks";

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
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="flex items-center gap-3 rounded-3xl border bg-background px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading builder…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-orange-500 transition hover:bg-orange-50"
            aria-label="Toggle block library"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-slate-900">VIC Store</span>
            <span className="hidden h-6 w-px bg-slate-200 md:block" />
            <span className="text-sm text-slate-500">Homepage Builder</span>
            {currentVersion > 0 && (() => {
              const isCurrentPublished = currentVersion === currentPublishedVersion;

              return (
                <>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    isCurrentPublished
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  )}>
                    v{currentVersion} {isCurrentPublished ? "published" : "draft"}
                  </span>
                  {currentPublishedVersion && currentPublishedVersion !== currentVersion && (
                    <span className="text-xs text-slate-400">
                      latest published: v{currentPublishedVersion}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition",
                canUndo ? "text-slate-700 hover:bg-slate-200" : "cursor-not-allowed text-slate-300"
              )}
              aria-label="Undo"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition",
                canRedo ? "text-slate-700 hover:bg-slate-200" : "cursor-not-allowed text-slate-300"
              )}
              aria-label="Redo"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition",
                device === "desktop"
                  ? "bg-white shadow text-slate-800"
                  : "text-slate-500 hover:bg-slate-200"
              )}
              aria-label="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("tablet")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition",
                device === "tablet" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:bg-slate-200"
              )}
              aria-label="Tablet preview"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md transition",
                device === "mobile" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:bg-slate-200"
              )}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden h-6 w-px bg-slate-200 md:block" />

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              splitView ? "bg-orange-100 text-orange-700" : "text-slate-700 hover:bg-slate-100"
            )}
            onClick={() => setSplitView((prev) => !prev)}
          >
            {splitView ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Split View
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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

          {/* Show Save button only for draft versions */}
          {!isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              onClick={handleSave}
              disabled={isSaving || !isDirty || blocks.length === 0}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}

          {/* Show Hot Fix button when editing a published version */}
          {isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              onClick={handleHotfix}
              disabled={isHotfixing || !isDirty || blocks.length === 0}
              title="Update published version directly without creating a new version"
            >
              {isHotfixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Hot Fix
            </Button>
          )}

          {/* Show Publish button only for draft versions */}
          {!isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            onClick={handleStartNewVersion}
            title="Start a new version from scratch"
          >
            <RefreshCcw className="h-4 w-4" />
            New Version
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-sm text-red-600">{error}</div>
      ) : null}
      {info ? (
        <div className="border-l-4 border-emerald-500 bg-emerald-50 px-6 py-3 text-sm text-emerald-600">
          {info}
        </div>
      ) : null}
      {currentVersion === currentPublishedVersion && !isDirty ? (
        <div className="border-l-4 border-blue-500 bg-blue-50 px-6 py-3 text-sm text-blue-700">
          <strong>Viewing published version {currentVersion}.</strong> Make changes and click <strong>Hot Fix</strong> to update this version directly, or click <strong>New Version</strong> to create a new draft.
        </div>
      ) : null}

      <main className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "h-full overflow-hidden border-r border-slate-200 bg-white transition-all duration-300",
            sidebarCollapsed ? "w-0" : "w-[120px]"
          )}
        >
          <div
            className={cn(
              "flex h-full flex-col",
              sidebarCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
            )}
          >
            {!sidebarCollapsed ? (
              <div className="border-b border-slate-200 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="flex w-full items-center justify-center rounded-md border border-slate-200 bg-white py-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <BlockLibrary />
          </div>
        </aside>

        <div className="flex flex-1 overflow-hidden px-6 py-6">
          <div className="flex w-full flex-col gap-6 lg:flex-row">
            {splitView ? (
              <section className="w-full lg:w-[20%] lg:transition-all lg:duration-300">
                <Canvas
                  onOpenSettings={() => {
                    setIsSettingsOpen(true);
                  }}
                />
              </section>
            ) : null}
            <section className={cn("w-full", splitView ? "lg:flex-1" : "lg:w-full")}>
              <LivePreview device={device} blocks={blocks} />
            </section>
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-lg">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
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
