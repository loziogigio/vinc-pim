"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Menu,
  Monitor,
  Smartphone,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Save,
  ChevronLeft,
  ChevronRight,
  Tablet,
  Upload,
  History,
  Settings2
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { VersionHistory } from "@/components/builder/VersionHistory";
import { PublishSettingsDialog, type PublishFormValues } from "@/components/builder/PublishSettingsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { usePageBuilderStore, type DeviceMode } from "@/lib/store/pageBuilderStore";
import type { PageConfig } from "@/lib/types/blocks";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Home page blocks that will be available
const HOME_PAGE_BLOCKS = [
  "hero-full-width",
  "hero-split",
  "hero-with-widgets",
  "carousel-hero",
  "carousel-products",
  "carousel-gallery",
  "content-rich-text",
  "content-custom-html",
  "youtubeEmbed",
  "media-image"
];

const defaultPublishForm: PublishFormValues = {
  campaign: "",
  segment: "",
  region: "",
  language: "",
  device: "",
  addressStates: "",
  priority: 0,
  isDefault: false,
  activeFrom: undefined,
  activeTo: undefined,
  comment: ""
};

const formatDateTimeLocal = (value?: string) => {
  if (!value) return undefined;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return undefined;
  }
};

const toISOStringFromLocal = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeTextInput = (value?: string) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseAddressStates = (value?: string): string[] | null => {
  if (!value) return null;
  const states = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  return states.length > 0 ? states : null;
};

const buildPublishPayload = (form: PublishFormValues) => {
  const addressStates = parseAddressStates(form.addressStates);

  const attributes: Record<string, any> = {
    region: normalizeTextInput(form.region),
    language: normalizeTextInput(form.language),
    device: normalizeTextInput(form.device)
  };

  // Add addressStates as an array if provided
  if (addressStates) {
    attributes.addressStates = addressStates;
  }

  return {
    campaign: normalizeTextInput(form.campaign),
    segment: normalizeTextInput(form.segment),
    attributes,
    priority: Number.isFinite(form.priority) ? form.priority : 0,
    isDefault: form.isDefault,
    activeFrom: toISOStringFromLocal(form.activeFrom),
    activeTo: toISOStringFromLocal(form.activeTo),
    comment: normalizeTextInput(form.comment)
  };
};

function HomeBuilderContent() {
  const searchParams = useSearchParams();
  const urlVersion = searchParams.get("v");

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
  const versions = usePageBuilderStore((state) => state.versions);

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBuilderVisible, setIsBuilderVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishTargetVersion, setPublishTargetVersion] = useState<number | null>(null);
  const [publishForm, setPublishForm] = useState<PublishFormValues>(defaultPublishForm);
  const [isHotfixing, setIsHotfixing] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [shopUrl, setShopUrl] = useState<string>("");

  const currentVersion = usePageBuilderStore((state) => state.currentVersion);
  const currentPublishedVersion = usePageBuilderStore((state) => state.currentPublishedVersion);

  // Check if the version being edited has "published" status (includes conditional published versions)
  const currentVersionData = versions.find((v) => v.version === currentVersion);
  const isEditingPublishedVersion = currentVersionData?.status === "published";

  // Check if version has conditional settings (tags with campaign, segment, or attributes)
  const versionTags = currentVersionData?.tags as { campaign?: string; segment?: string; attributes?: Record<string, string | string[]> } | undefined;
  const hasConditionalSettings = !!(
    versionTags?.campaign ||
    versionTags?.segment ||
    (versionTags?.attributes && Object.keys(versionTags.attributes).length > 0)
  );

  // It's "default published" only if it's the current published AND has no conditional settings
  const isDefaultPublishedVersion = currentVersion === currentPublishedVersion && !hasConditionalSettings;
  const isConditionalPublishedVersion = isEditingPublishedVersion && hasConditionalSettings;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Helper to update URL with version (without triggering navigation)
  const updateUrlVersion = (version: number) => {
    const url = new URL(window.location.href);
    const currentUrlVersion = url.searchParams.get("v");

    // Only update if version is different to avoid unnecessary history entries
    if (currentUrlVersion !== String(version)) {
      url.searchParams.set("v", String(version));
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  };

  useEffect(() => {
    // Load home page template (only runs once on mount)
    const loadTemplate = async () => {
      try {
        // Build URL with version param if provided in initial URL
        const apiUrl = urlVersion
          ? `/api/home-template?v=${urlVersion}`
          : `/api/home-template`;

        const response = await fetch(apiUrl, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Failed to load home page template");
        }

        const config = await response.json();
        console.log("Loaded home page template:", config);
        loadPageConfig(config);

        // Update URL to reflect the loaded version
        if (config.currentVersion) {
          updateUrlVersion(config.currentVersion);
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load home page configuration");
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPageConfig]); // Only run on mount, urlVersion is read once

  // Fetch home settings to get shopUrl for LivePreview
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/b2b/home-settings");
        if (response.ok) {
          const data = await response.json();
          if (data.branding?.shopUrl) {
            setShopUrl(data.branding.shopUrl);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch home settings for shopUrl:", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (selectedBlockId) {
      setIsSettingsOpen(true);
    }
  }, [selectedBlockId]);

  const closeSettings = () => {
    setIsSettingsOpen(false);
    selectBlock(null);
  };

  const handlePublishFormChange = (field: keyof PublishFormValues, value: string | number | boolean) => {
    setPublishForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const openPublishDialog = (version: number) => {
    const target = versions.find((v) => v.version === version);
    // Convert addressStates array back to comma-separated string for the form
    const addressStatesArray = target?.tags?.attributes?.addressStates;
    const addressStatesString = Array.isArray(addressStatesArray)
      ? addressStatesArray.join(", ")
      : "";

    setPublishTargetVersion(version);
    setPublishForm({
      campaign: target?.tags?.campaign ?? "",
      segment: target?.tags?.segment ?? "",
      region: target?.tags?.attributes?.region ?? "",
      language: target?.tags?.attributes?.language ?? "",
      device: target?.tags?.attributes?.device ?? "",
      addressStates: addressStatesString,
      priority: target?.priority ?? 0,
      isDefault: Boolean(target?.isDefault),
      activeFrom: formatDateTimeLocal(target?.activeFrom),
      activeTo: formatDateTimeLocal(target?.activeTo),
      comment: target?.comment ?? ""
    });
    setIsPublishModalOpen(true);
  };

  const closePublishDialog = () => {
    setIsPublishModalOpen(false);
    setPublishTargetVersion(null);
    setPublishForm(defaultPublishForm);
  };

  const handlePublishButtonClick = () => {
    if (currentVersion > 0) {
      openPublishDialog(currentVersion);
    }
  };

  const handleRequestPublishVersion = (version: number) => {
    openPublishDialog(version);
  };

  const iconButtonClass =
    "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]";
  const disabledIconButtonClass = "cursor-not-allowed opacity-30 hover:bg-transparent";

  const toggleBuilderPanel = () => {
    setIsBuilderVisible((prev) => !prev);
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
      const nowISO = new Date().toISOString();
      const currentVersionData =
        state.versions.find((version) => version.version === state.currentVersion) ||
        state.versions[state.versions.length - 1];

      const previewVersion: PageConfig["versions"][number] = {
        version: currentVersionData?.version || state.currentVersion || 1,
        blocks: state.blocks.map((block, index) => ({
          ...block,
          order: index
        })),
        seo: state.pageDetails.seo,
        status: (currentVersionData?.status || "draft") as "draft" | "published",
        createdAt: currentVersionData?.createdAt || nowISO,
        lastSavedAt: nowISO,
        publishedAt: currentVersionData?.publishedAt,
        createdBy: currentVersionData?.createdBy || "b2b-admin",
        comment: currentVersionData?.comment || "Preview version"
      };

      const hasMatchingVersion = state.versions.some((version) => version.version === previewVersion.version);
      const previewVersions: PageConfig["versions"] = hasMatchingVersion
        ? state.versions.map((version) => (version.version === previewVersion.version ? previewVersion : version))
        : [...state.versions, previewVersion];

      const previewPayload: PageConfig = {
        slug: "home",
        name: state.pageDetails.name || "Home Page",
        versions: previewVersions,
        currentVersion: previewVersion.version,
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
        throw new Error(errorData.error || "Failed to publish preview");
      }

      window.open("/preview?slug=home", "_blank", "noopener,noreferrer");
    } catch (previewError) {
      console.error(previewError);
      setError("Unable to open preview. Please try again.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = getPagePayload();

      const response = await fetch("/api/home-template/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: payload.blocks,
          seo: payload.seo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      const saved = await response.json();
      loadPageConfig(saved);
      markSaved();

      const currentVersionData = saved.versions[saved.versions.length - 1];
      const statusLabel = currentVersionData?.status === "published" ? "published" : "draft";

      setInfo(`Version ${saved.currentVersion} (${statusLabel}) saved successfully`);
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleHotfix = async () => {
    setIsHotfixing(true);
    setError(null);
    setInfo(null);
    try {
      const payload = getPagePayload();

      // Use same save-draft endpoint - it will detect published version and apply hotfix
      const response = await fetch("/api/home-template/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: payload.blocks,
          seo: payload.seo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to apply hotfix");
      }

      const updated = await response.json();
      loadPageConfig(updated);
      markSaved();
      setInfo(`Hot fix applied to Version ${currentVersion}! Changes are live.`);
    } catch (hotfixError) {
      console.error(hotfixError);
      setError("Unable to apply hotfix. Please try again.");
    } finally {
      setIsHotfixing(false);
    }
  };

  const executePublish = async (targetVersion: number, formValues: PublishFormValues) => {
    setIsPublishing(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPublishPayload(formValues);
      const isCurrentVersionMatch = targetVersion === currentVersion;
      const isCurrentlyPublished = targetVersion === currentPublishedVersion;
      const versionData = versions.find((version) => version.version === targetVersion);
      const versionStatus = versionData?.status;
      const shouldUsePublishVersionEndpoint =
        !isCurrentVersionMatch || isCurrentlyPublished || versionStatus === "published";

      const endpoint = shouldUsePublishVersionEndpoint
        ? "/api/home-template/publish-version"
        : "/api/home-template/publish";

      const body = shouldUsePublishVersionEndpoint
        ? { version: targetVersion, ...payload }
        : payload;

      console.log("[executePublish] Publishing version:", targetVersion);
      console.log("[executePublish] Endpoint:", endpoint);
      console.log("[executePublish] Payload:", JSON.stringify(body, null, 2));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to publish" }));
        throw new Error(errorData.error || "Failed to publish");
      }

      const updated = await response.json();
      console.log("[executePublish] Response received:", JSON.stringify(updated, null, 2));

      // Check if the version was actually published
      const publishedVersion = updated.versions?.find((v: any) => v.version === targetVersion);
      console.log("[executePublish] Published version status:", publishedVersion?.status);
      console.log("[executePublish] Published version tags:", publishedVersion?.tags);

      loadPageConfig(updated);

      // Update URL to reflect the current version
      if (updated.currentVersion) {
        updateUrlVersion(updated.currentVersion);
      }

      setInfo(`Version ${targetVersion} published successfully as ${publishedVersion?.status || "unknown"}.`);
      closePublishDialog();
    } catch (publishError) {
      console.error(publishError);
      const errorMessage =
        publishError instanceof Error ? publishError.message : "Unable to publish. Please try again.";
      setError(errorMessage);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (publishTargetVersion == null) return;
    await executePublish(publishTargetVersion, publishForm);
  };

  const handleStartNewVersion = async () => {
    const confirmNew = window.confirm(
      "Start a new version? This will create a fresh draft based on the latest published version."
    );
    if (!confirmNew) return;

    try {
      const response = await fetch("/api/home-template/start-new-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to start new version" }));
        throw new Error(errorData.error || "Failed to start new version");
      }

      const config = await response.json();
      loadPageConfig(config);

      // Update URL to reflect the new version
      if (config.currentVersion) {
        updateUrlVersion(config.currentVersion);
      }

      setInfo(`New draft version v${config?.currentVersion} created. Make your changes and save.`);
    } catch (err) {
      console.error(err);
      setError("Failed to start new version");
    }
  };

  const handleLoadVersion = async (version: number) => {
    try {
      const response = await fetch("/api/home-template/load-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to load version" }));
        throw new Error(errorData.error || "Failed to load version");
      }

      const config = await response.json();
      loadPageConfig(config);
      setIsVersionHistoryOpen(false);

      // Update URL to reflect the loaded version
      updateUrlVersion(config.currentVersion);

      setInfo(`Loaded version v${version}. Now editing as version v${config.currentVersion}.`);
    } catch (err) {
      console.error(err);
      setError("Unable to load version. Please try again.");
    }
  };

  const handleDeleteVersion = async (version: number) => {
    try {
      const response = await fetch("/api/home-template/delete-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete version" }));
        throw new Error(errorData.error || "Failed to delete version");
      }

      const config = await response.json();
      loadPageConfig(config);

      // Update URL to reflect the current version
      if (config.currentVersion) {
        updateUrlVersion(config.currentVersion);
      }

      setInfo(`Deleted version v${version}.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to delete version. Please try again.";
      setError(message);
    }
  };

  const handleDuplicateVersion = async (version: number) => {
    try {
      const response = await fetch("/api/home-template/duplicate-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to duplicate version" }));
        throw new Error(errorData.error || "Failed to duplicate version");
      }

      const config = await response.json();
      loadPageConfig(config);
      setIsVersionHistoryOpen(false);

      // Update URL to reflect the new version
      if (config.currentVersion) {
        updateUrlVersion(config.currentVersion);
      }

      setInfo(`Duplicated version v${version} as v${config.currentVersion}.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to duplicate version. Please try again.";
      setError(message);
    }
  };

  const handleRenameVersion = async (version: number, label: string) => {
    try {
      const response = await fetch("/api/home-template/update-version", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, label })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to update version metadata" }));
        throw new Error(errorData.error || "Failed to update version metadata");
      }

      const config = await response.json();
      loadPageConfig(config);

      const trimmed = label.trim();
      setInfo(`Version v${version} renamed to "${trimmed || `Version ${version}`}".`);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Unable to update version metadata. Please try again.";
      setError(message);
    }
  };


  const handleUnpublishVersion = async (version: number) => {
    try {
      const response = await fetch("/api/home-template/unpublish-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to unpublish version" }));
        throw new Error(errorData.error || "Failed to unpublish version");
      }

      const config = await response.json();
      loadPageConfig(config);
      setInfo(`Version v${version} reverted to draft.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to unpublish version. Please try again.";
      setError(message);
    }
  };

  const autosaveMessage = useMemo(() => {
    if (isSaving) return "Saving changes…";
    if (isDirty) return "Unsaved edits — remember to save.";
    return "All changes saved.";
  }, [isDirty, isSaving]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f7fa]">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Builder Toolbar */}
      <div className="flex h-[56px] items-center border-b border-slate-200 bg-white px-6">
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
              <span className="text-[1rem] font-semibold text-[#5e5873]">Home Page Builder</span>

              {currentVersion > 0 ? (
                <>
                  <span
                    className={cn(
                      "rounded-[0.358rem] px-[0.714rem] py-[0.286rem] text-[0.786rem] font-semibold",
                      isDefaultPublishedVersion
                        ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]"
                        : isConditionalPublishedVersion
                          ? "bg-[rgba(33,150,243,0.12)] text-[#1565c0]"
                          : isEditingPublishedVersion
                            ? "bg-[rgba(156,39,176,0.12)] text-[#7b1fa2]"
                            : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"
                    )}
                  >
                    {isDefaultPublishedVersion
                      ? "✓ Default Published"
                      : isConditionalPublishedVersion
                        ? "✓ Published (Conditional)"
                        : isEditingPublishedVersion
                          ? "✓ Published"
                          : "Draft"}{" "}
                    · v{currentVersion}
                  </span>
                  {currentPublishedVersion && currentPublishedVersion !== currentVersion ? (
                    <span className="text-[0.786rem] text-[#b9b9c3]">default: v{currentPublishedVersion}</span>
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
                device === "desktop" ? "bg-[#009688] text-white shadow" : "text-[#5e5873] hover:bg-white"
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
                device === "tablet" ? "bg-[#009688] text-white shadow" : "text-[#5e5873] hover:bg-white"
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
                device === "mobile" ? "bg-[#009688] text-white shadow" : "text-[#5e5873] hover:bg-white"
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
              "flex items-center gap-2 rounded-[0.358rem] border px-[1rem] py-[0.571rem] text-[0.95rem] font-medium transition",
              isBuilderVisible
                ? "border-[#ebe9f1] bg-white text-[#5e5873] shadow-sm"
                : "border-[#ebe9f1] bg-[#fafafc] text-[#5e5873] hover:bg-white"
            )}
            onClick={toggleBuilderPanel}
            title={isBuilderVisible ? "Hide Block Builder" : "Show Block Builder"}
          >
            {isBuilderVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Block Builder
          </Button>

          {isEditingPublishedVersion ? (
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 rounded-[0.358rem] border border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#1565c0] transition hover:bg-[rgba(33,150,243,0.15)]"
              onClick={handlePublishButtonClick}
              title="Edit conditional settings for this published version"
            >
              <Settings2 className="h-4 w-4" />
              Condition
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] transition hover:bg-white"
            onClick={() => {
              console.log("Opening home template version history. Versions:", versions);
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
              Save Draft
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

          {!isEditingPublishedVersion && currentVersion > 0 && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] transition hover:bg-[#00796b]"
              onClick={handlePublishButtonClick}
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
        </div>
      </div>

      {error ? (
        <div className="border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600">{error}</div>
      ) : null}
      {info ? (
        <div className="border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]">
          {info}
        </div>
      ) : null}
      {isEditingPublishedVersion && !isDirty ? (
        <div className="border-l-4 border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-6 py-3 text-[0.857rem] text-[#1976d2]">
          <strong>Viewing {isConditionalPublishedVersion ? "conditional" : isDefaultPublishedVersion ? "default" : ""} published version {currentVersion}.</strong> Make changes and click <strong>Hot Fix</strong> to update this version directly, or click <strong>New Version</strong> to create a new draft.
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
            <BlockLibrary allowedBlockIds={HOME_PAGE_BLOCKS} />
          </div>
        </aside>

        <div className="flex flex-1 min-w-0 overflow-hidden">
          <section
            className={cn(
              "flex h-full flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed] transition-all duration-300",
              isBuilderVisible ? "w-[360px] min-w-[320px]" : "w-[60px] min-w-[60px]"
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
            <LivePreview device={device} blocks={blocks} pageType="home" isDirty={isDirty} customerWebUrl={shopUrl || undefined} />
          </section>
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
          onRenameVersion={handleRenameVersion}
          onRequestPublishVersion={handleRequestPublishVersion}
          onUnpublishVersion={handleUnpublishVersion}
          onClose={() => setIsVersionHistoryOpen(false)}
        />
      )}

      <PublishSettingsDialog
        open={isPublishModalOpen}
        version={publishTargetVersion}
        values={publishForm}
        isSubmitting={isPublishing}
        onChange={handlePublishFormChange}
        onClose={closePublishDialog}
        onSubmit={handlePublishSubmit}
      />
    </div>
  );
}

export default function HomeBuilderPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <HomeBuilderContent />
    </Suspense>
  );
}
