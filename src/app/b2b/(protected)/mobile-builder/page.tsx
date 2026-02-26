"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Save,
  Upload,
  Plus,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  History,
  ChevronDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  type MobileBlock,
  type MobileBlockType,
  type MobileAppIdentity,
  MOBILE_BLOCK_LIBRARY,
  DEFAULT_APP_IDENTITY,
  createDefaultBlock,
} from "@/lib/types/mobile-builder";
import { MobilePreview } from "@/components/mobile-builder/MobilePreview";
import { MobileBlockSettings } from "@/components/mobile-builder/MobileBlockSettings";
import { AppIdentitySettings } from "@/components/mobile-builder/AppIdentitySettings";
import { SortableBlockItem } from "@/components/mobile-builder/SortableBlockItem";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface VersionInfo {
  version: number;
  status: "draft" | "published";
  is_current: boolean;
  is_current_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function MobileBuilderPage() {
  const [blocks, setBlocks] = useState<MobileBlock[]>([]);
  const [appIdentity, setAppIdentity] = useState<MobileAppIdentity>(DEFAULT_APP_IDENTITY);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning" | "info" | "success";
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setShowVersionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load versions list
  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch("/api/b2b/mobile-builder/config/versions");
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  }, []);

  // Load config for a specific version
  const loadConfig = useCallback(async (version?: number) => {
    try {
      const url = version
        ? `/api/b2b/mobile-builder/config?version=${version}`
        : "/api/b2b/mobile-builder/config";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load config");
      }
      const data = await response.json();
      if (data.config) {
        setBlocks(data.config.blocks || []);
        setAppIdentity({ ...DEFAULT_APP_IDENTITY, ...data.config.app_identity });
        setCurrentVersion(data.config.version || 1);
      }
    } catch (err) {
      console.error("Error loading mobile config:", err);
      setError("Failed to load configuration");
    }
  }, []);

  // Load config and versions on mount
  useEffect(() => {
    const init = async () => {
      await loadConfig();
      await loadVersions();
      setIsLoading(false);
    };
    init();
  }, [loadConfig, loadVersions]);

  // Create new version
  const handleCreateNewVersion = async () => {
    if (isDirty) {
      setError("Please save your changes before creating a new version");
      return;
    }

    setIsCreatingVersion(true);
    setError(null);
    try {
      const response = await fetch("/api/b2b/mobile-builder/config/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_version: currentVersion }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create version");
      }

      const data = await response.json();
      setBlocks(data.config.blocks || []);
      setAppIdentity({ ...DEFAULT_APP_IDENTITY, ...data.config.app_identity });
      setCurrentVersion(data.config.version);
      setIsDirty(false);
      await loadVersions();
      setInfo(`New version ${data.config.version} created`);
    } catch (err) {
      console.error("Error creating version:", err);
      setError(err instanceof Error ? err.message : "Failed to create version");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  // Actually perform the version switch
  const performSwitchVersion = async (version: number) => {
    setShowVersionDropdown(false);
    setIsLoading(true);
    try {
      const response = await fetch("/api/b2b/mobile-builder/config/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to switch version");
      }

      const data = await response.json();
      setBlocks(data.config.blocks || []);
      setAppIdentity({ ...DEFAULT_APP_IDENTITY, ...data.config.app_identity });
      setCurrentVersion(data.config.version);
      setIsDirty(false);
      await loadVersions();
      setInfo(`Switched to version ${version}`);
    } catch (err) {
      console.error("Error switching version:", err);
      setError(err instanceof Error ? err.message : "Failed to switch version");
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to a different version (with confirmation if dirty)
  const handleSwitchVersion = (version: number) => {
    if (isDirty) {
      setConfirmDialog({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Switch version anyway? Your changes will be lost.",
        variant: "warning",
        confirmText: "Switch Anyway",
        onConfirm: () => {
          setConfirmDialog(null);
          performSwitchVersion(version);
        },
      });
      return;
    }
    performSwitchVersion(version);
  };

  // Update app identity
  const handleUpdateAppIdentity = useCallback((updates: Partial<MobileAppIdentity>) => {
    setAppIdentity((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
    setError(null);
  }, []);

  // Add a new block
  const handleAddBlock = useCallback((type: MobileBlockType) => {
    const newBlock = createDefaultBlock(type, nanoid());
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setIsDirty(true);
    setError(null);
  }, []);

  // Delete a block
  const handleDeleteBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setIsDirty(true);
  }, [selectedBlockId]);

  // Update a block
  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<MobileBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...updates } as MobileBlock : b))
    );
    setIsDirty(true);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setIsDirty(true);
    }
  }, []);

  // Save draft (updates current version in place)
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/b2b/mobile-builder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, app_identity: appIdentity }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await response.json();
      setCurrentVersion(data.config.version);
      setIsDirty(false);
      await loadVersions();
      setInfo(`Draft saved (version ${data.config.version})`);
    } catch (err) {
      console.error("Error saving:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Actually perform publish
  const performPublish = async () => {
    setIsPublishing(true);
    setError(null);
    try {
      const response = await fetch("/api/b2b/mobile-builder/config/publish", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to publish");
      }

      const data = await response.json();
      await loadVersions();
      setInfo(`Version ${data.config.version} is now live`);
    } catch (err) {
      console.error("Error publishing:", err);
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  // Publish (with confirmation)
  const handlePublish = () => {
    setConfirmDialog({
      title: "Publish Version",
      message: `Publish version ${currentVersion}? This will make it live for all mobile app users.`,
      variant: "success",
      confirmText: "Publish",
      onConfirm: () => {
        setConfirmDialog(null);
        performPublish();
      },
    });
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const currentVersionInfo = versions.find((v) => v.version === currentVersion);
  const isLiveVersion = currentVersionInfo?.is_current_published ?? false;

  // Hot Fix: save + publish in one step (for editing the live version)
  const handleHotfix = async () => {
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      // Step 1: Save
      const saveRes = await fetch("/api/b2b/mobile-builder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, app_identity: appIdentity }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || "Failed to save");
      }
      const saveData = await saveRes.json();
      setCurrentVersion(saveData.config.version);
      setIsDirty(false);

      // Step 2: Publish
      setIsSaving(false);
      setIsPublishing(true);
      const pubRes = await fetch("/api/b2b/mobile-builder/config/publish", {
        method: "POST",
      });
      if (!pubRes.ok) {
        const data = await pubRes.json();
        throw new Error(data.error || "Failed to publish");
      }
      const pubData = await pubRes.json();
      await loadVersions();
      setInfo(`Hot fix applied to version ${pubData.config.version}! Changes are live.`);
    } catch (err) {
      console.error("Error applying hotfix:", err);
      setError(err instanceof Error ? err.message : "Failed to apply hotfix");
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Toolbar */}
      <div className="flex h-14 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-slate-600" />
            <span className="text-lg font-semibold text-gray-800">Mobile Home Builder</span>

            {/* Version Selector Dropdown */}
            <div className="relative" ref={versionDropdownRef}>
              <button
                type="button"
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
              >
                <History className="h-3 w-3" />
                v{currentVersion}
                <ChevronDown className="h-3 w-3" />
              </button>

              {showVersionDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border bg-white py-1 shadow-lg">
                  <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500">
                    Versions
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {versions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No versions yet</div>
                    ) : (
                      versions.map((v) => (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => handleSwitchVersion(v.version)}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50",
                            v.version === currentVersion && "bg-slate-50 text-slate-600"
                          )}
                        >
                          <span>v{v.version}</span>
                          <div className="flex items-center gap-1">
                            {v.is_current && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                                current
                              </span>
                            )}
                            {v.is_current_published && (
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-600">
                                live
                              </span>
                            )}
                            {v.status === "draft" && !v.is_current_published && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                draft
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t px-2 py-2">
                    <button
                      type="button"
                      onClick={handleCreateNewVersion}
                      disabled={isCreatingVersion || isDirty}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isCreatingVersion ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Create New Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicators */}
          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}
          {!isDirty && isLiveVersion && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live
            </span>
          )}

          {isLiveVersion ? (
            /* Live version: Hot Fix button (save + publish) */
            <Button
              onClick={handleHotfix}
              disabled={isSaving || isPublishing || !isDirty}
              className="gap-2 bg-gradient-to-tr from-[#ff5722] to-[rgba(255,87,34,0.7)] text-white shadow-[0_0_10px_1px_rgba(255,87,34,0.4)] hover:from-[#f4511e] hover:to-[rgba(244,81,30,0.7)] disabled:opacity-50"
              title="Update published version directly"
            >
              {isSaving || isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Hot Fix
            </Button>
          ) : (
            /* Draft version: Save Draft + Publish as separate actions */
            <>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </Button>

              <div className="relative group">
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || isDirty}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50"
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Publish
                </Button>
                {isDirty && (
                  <div className="pointer-events-none absolute -bottom-8 right-0 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    Save your draft first
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {info && (
        <div
          className={cn(
            "border-l-4 px-6 py-3 text-sm",
            info.includes("live")
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-slate-500 bg-slate-50 text-slate-600"
          )}
        >
          {info}
        </div>
      )}
      {isLiveVersion && !isDirty && !info && !error && (
        <div className="border-l-4 border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-6 py-3 text-sm text-[#1976d2]">
          <strong>Viewing published version {currentVersion}.</strong> Make changes and click{" "}
          <strong>Hot Fix</strong> to update directly, or create a <strong>New Version</strong> from
          the version menu.
        </div>
      )}

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left sidebar - App Identity + Block Library */}
        <aside
          className={cn(
            "flex flex-col border-r bg-white transition-all duration-300",
            sidebarCollapsed ? "w-0 overflow-hidden" : "w-72"
          )}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* App Identity Section */}
            <AppIdentitySettings
              appIdentity={appIdentity}
              onChange={handleUpdateAppIdentity}
            />

            {/* Block Library */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Block Library</h2>
              <div className="space-y-2">
                {MOBILE_BLOCK_LIBRARY.map((blockMeta) => (
                  <button
                    key={blockMeta.type}
                    type="button"
                    onClick={() => handleAddBlock(blockMeta.type)}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">{blockMeta.name}</div>
                      <div className="text-xs text-gray-500">{blockMeta.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center - Canvas (Block list) */}
        <section className="flex w-80 flex-col border-r bg-gray-50">
          <div className="border-b bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700">Canvas</h2>
            <p className="text-xs text-gray-500">Drag to reorder blocks</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
                <Eye className="mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500">No blocks added yet</p>
                <p className="text-xs text-gray-400">Click a block in the library to add it</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {blocks.map((block, index) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        index={index}
                        isSelected={selectedBlockId === block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        onDelete={() => handleDeleteBlock(block.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </section>

        {/* Right side - Preview + Settings */}
        <section className="flex flex-1 overflow-hidden">
          {/* Phone Preview */}
          <div className="flex flex-1 items-start justify-center bg-gray-100 px-4 pt-6 pb-8 overflow-y-auto">
            <MobilePreview blocks={blocks} appIdentity={appIdentity} />
          </div>

          {/* Settings Panel */}
          {selectedBlock && (
            <aside className="w-96 border-l bg-white overflow-y-auto">
              <MobileBlockSettings
                block={selectedBlock}
                onUpdate={(updates) => handleUpdateBlock(selectedBlock.id, updates)}
                onClose={() => setSelectedBlockId(null)}
              />
            </aside>
          )}
        </section>
      </main>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        variant={confirmDialog?.variant ?? "warning"}
        confirmText={confirmDialog?.confirmText ?? "Confirm"}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
