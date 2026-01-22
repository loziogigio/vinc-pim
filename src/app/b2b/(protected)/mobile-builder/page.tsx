"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Save,
  Upload,
  GripVertical,
  Trash2,
  Settings,
  Plus,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Link as LinkIcon,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/utils";
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

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Sortable block item component
function SortableBlockItem({
  block,
  index,
  isSelected,
  onClick,
  onDelete,
}: {
  block: MobileBlock;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blockMeta = MOBILE_BLOCK_LIBRARY.find((b) => b.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-white p-3 transition-all",
        isDragging ? "opacity-50 shadow-lg" : "",
        isSelected ? "border-slate-500 ring-2 ring-slate-200" : "border-gray-200"
      )}
    >
      {/* Block number */}
      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-600">
        {index + 1}
      </span>

      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {blockMeta?.name || block.type}
        </span>
      </button>

      <button
        type="button"
        onClick={onClick}
        className="p-1 text-gray-400 hover:text-gray-600"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-gray-400 hover:text-red-500"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// App Identity Settings Component
function AppIdentitySettings({
  appIdentity,
  onChange,
}: {
  appIdentity: MobileAppIdentity;
  onChange: (updates: Partial<MobileAppIdentity>) => void;
}) {
  const [logoInputMode, setLogoInputMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/b2b/editor/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      onChange({ logo_url: data.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-gray-700">App Identity</h3>
      </div>

      {/* App Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">App Name</Label>
        <Input
          value={appIdentity.app_name}
          onChange={(e) => onChange({ app_name: e.target.value })}
          placeholder="My App"
          className="h-8 text-sm"
        />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Logo</Label>
          <div className="flex rounded-md border bg-white">
            <button
              type="button"
              onClick={() => setLogoInputMode("upload")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition",
                logoInputMode === "upload"
                  ? "bg-slate-100 text-slate-700"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setLogoInputMode("url")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition",
                logoInputMode === "url"
                  ? "bg-slate-100 text-slate-700"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LinkIcon className="h-3 w-3" />
              URL
            </button>
          </div>
        </div>

        {logoInputMode === "upload" ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {isUploading ? "Uploading..." : "Choose Image"}
            </Button>
            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}
          </div>
        ) : (
          <Input
            value={appIdentity.logo_url}
            onChange={(e) => onChange({ logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="h-8 text-sm"
          />
        )}

        {/* Logo Preview */}
        {appIdentity.logo_url && (
          <div className="flex items-center gap-2 rounded border bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={appIdentity.logo_url}
              alt="Logo preview"
              className="h-10 w-auto object-contain"
            />
            <button
              type="button"
              onClick={() => onChange({ logo_url: "" })}
              className="ml-auto text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Logo Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Width (px)</Label>
          <Input
            type="number"
            value={appIdentity.logo_width}
            onChange={(e) => onChange({ logo_width: parseInt(e.target.value) || 64 })}
            min={20}
            max={200}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Height (px)</Label>
          <Input
            type="number"
            value={appIdentity.logo_height || ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ logo_height: val ? parseInt(val) : undefined });
            }}
            placeholder="Auto"
            min={20}
            max={100}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-1.5">
        <Label className="text-xs">Primary Color (Buttons)</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={appIdentity.primary_color || "#ec4899"}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-gray-300 p-0.5"
          />
          <Input
            value={appIdentity.primary_color || "#ec4899"}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            placeholder="#ec4899"
            className="h-8 text-sm font-mono flex-1"
          />
        </div>
      </div>
    </div>
  );
}

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
        setAppIdentity(data.config.app_identity || DEFAULT_APP_IDENTITY);
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
      setAppIdentity(data.config.app_identity || DEFAULT_APP_IDENTITY);
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

  // Switch to a different version
  const handleSwitchVersion = async (version: number) => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Switch version anyway? Changes will be lost."
      );
      if (!confirmed) return;
    }

    setShowVersionDropdown(false);
    setIsLoading(true);
    try {
      // Set this version as current
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
      setAppIdentity(data.config.app_identity || DEFAULT_APP_IDENTITY);
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

  // Publish
  const handlePublish = async () => {
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
      setInfo(`Published version ${data.config.version}`);
    } catch (err) {
      console.error("Error publishing:", err);
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

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

        <div className="flex items-center gap-2">
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

          <Button
            onClick={handlePublish}
            disabled={isPublishing || isDirty}
            className="gap-2 bg-slate-600 hover:bg-slate-700"
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

      {/* Alerts */}
      {error && (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {info && (
        <div className="border-l-4 border-slate-500 bg-slate-50 px-6 py-3 text-sm text-slate-600">
          {info}
        </div>
      )}

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left sidebar - App Identity + Block Library */}
        <aside
          className={cn(
            "flex flex-col border-r bg-white transition-all duration-300",
            sidebarCollapsed ? "w-0 overflow-hidden" : "w-64"
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
          <div className="flex flex-1 items-center justify-center bg-gray-100 p-8">
            <MobilePreview blocks={blocks} appIdentity={appIdentity} />
          </div>

          {/* Settings Panel */}
          {selectedBlock && (
            <aside className="w-80 border-l bg-white overflow-y-auto">
              <MobileBlockSettings
                block={selectedBlock}
                onUpdate={(updates) => handleUpdateBlock(selectedBlock.id, updates)}
                onClose={() => setSelectedBlockId(null)}
              />
            </aside>
          )}
        </section>
      </main>
    </div>
  );
}
