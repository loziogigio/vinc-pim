"use client";

/**
 * B2B Home Builder — forked from src/app/b2b/(builder)/b2c-home-builder/page.tsx
 * (itself a fork of the legacy src/app/b2b/(builder)/home-builder/page.tsx).
 *
 * The portal slug comes from the `?portal=` query param (default "default").
 * All home-template API calls are scoped to the Phase-1 portal routes:
 *   /api/b2b/b2b/portals/[slug]/home-template/*
 * and the live-preview branding/domain comes from:
 *   GET /api/b2b/b2b/portals/[slug]
 *
 * The legacy /b2b/home-builder page and the legacy /api/home-template/* and
 * /api/b2b/home-settings routes are NOT touched — the two builders coexist.
 */

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
  Settings2,
  ArrowLeft,
} from "lucide-react";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { BlockLibrary } from "@/components/builder/BlockLibrary";
import { Canvas } from "@/components/builder/Canvas";
import { BlockSettingsModal } from "@/components/builder/BlockSettingsModal";
import { LivePreview } from "@/components/builder/LivePreview";
import { VersionHistory } from "@/components/builder/VersionHistory";
import {
  PublishSettingsDialog,
  type PublishFormValues,
} from "@/components/builder/PublishSettingsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  usePageBuilderStore,
  type DeviceMode,
} from "@/lib/store/pageBuilderStore";
import { b2bHomeTemplateApi, DEFAULT_PORTAL_SLUG } from "./api";

export const dynamic = "force-dynamic";

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
  "media-image",
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
  comment: "",
};

const formatDateTimeLocal = (value?: string) => {
  if (!value) return undefined;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}`;
  } catch {
    return undefined;
  }
};

const toISOStringFromLocal = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    device: normalizeTextInput(form.device),
  };
  if (addressStates) attributes.addressStates = addressStates;

  return {
    campaign: normalizeTextInput(form.campaign),
    segment: normalizeTextInput(form.segment),
    attributes,
    priority: Number.isFinite(form.priority) ? form.priority : 0,
    isDefault: form.isDefault,
    activeFrom: toISOStringFromLocal(form.activeFrom),
    activeTo: toISOStringFromLocal(form.activeTo),
    comment: normalizeTextInput(form.comment),
  };
};

/** Detects the Phase-1 409 NOT_MIGRATED write-gate response. */
const isNotMigratedResponse = (status: number, body: any) =>
  status === 409 && body?.code === "NOT_MIGRATED";

function B2BHomeBuilderContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const portalSlug = searchParams.get("portal") || DEFAULT_PORTAL_SLUG;
  const urlVersion = searchParams.get("v");
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // API endpoints scoped to the portal
  const api = useMemo(() => b2bHomeTemplateApi(portalSlug), [portalSlug]);
  const apiBase = api.base;
  const portalDetailHref = `${tenantPrefix}/b2b/b2b/portals/${portalSlug}`;

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
  const versions = usePageBuilderStore((s) => s.versions);
  const currentVersion = usePageBuilderStore((s) => s.currentVersion);
  const currentPublishedVersion = usePageBuilderStore(
    (s) => s.currentPublishedVersion
  );

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBuilderVisible, setIsBuilderVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Set when a write hits the Phase-1 409 NOT_MIGRATED gate. */
  const [notMigrated, setNotMigrated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishTargetVersion, setPublishTargetVersion] = useState<
    number | null
  >(null);
  const [publishForm, setPublishForm] =
    useState<PublishFormValues>(defaultPublishForm);
  const [isHotfixing, setIsHotfixing] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | undefined>();

  // Derived state
  const currentVersionData = versions.find(
    (v) => v.version === currentVersion
  );
  const isEditingPublishedVersion =
    currentVersionData?.status === "published";
  const versionTags = currentVersionData?.tags as
    | {
        campaign?: string;
        segment?: string;
        attributes?: Record<string, string | string[]>;
      }
    | undefined;
  const hasConditionalSettings = !!(
    versionTags?.campaign ||
    versionTags?.segment ||
    (versionTags?.attributes &&
      Object.keys(versionTags.attributes).length > 0)
  );
  const isDefaultPublishedVersion =
    currentVersion === currentPublishedVersion && !hasConditionalSettings;
  const isConditionalPublishedVersion =
    isEditingPublishedVersion && hasConditionalSettings;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const autosaveMessage = useMemo(() => {
    if (isLoading) return t("common.loading");
    if (isSaving) return t("pages.builder.b2bHomeBuilder.savingChanges");
    if (isDirty) return t("pages.builder.b2bHomeBuilder.unsavedChanges");
    return t("pages.builder.b2bHomeBuilder.allChangesSaved");
  }, [isLoading, isSaving, isDirty, t]);

  const updateUrlVersion = (version: number) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") !== String(version)) {
      url.searchParams.set("v", String(version));
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  };

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
    const loadTemplate = async () => {
      try {
        const url = urlVersion ? api.get(urlVersion) : apiBase;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load template");
        const config = await res.json();
        loadPageConfig(config);
        if (config.currentVersion) updateUrlVersion(config.currentVersion);
      } catch (err) {
        console.error(err);
        setError("Failed to load portal home page configuration");
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPageConfig, apiBase]);

  // Fetch the portal's primary domain for the live-preview iframe.
  // The portal GET returns the raw portal document (not wrapped in { data }).
  useEffect(() => {
    const fetchPortalDomain = async () => {
      try {
        const res = await fetch(api.portal);
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
  }, [api.portal]);

  useEffect(() => {
    if (selectedBlockId) setIsSettingsOpen(true);
  }, [selectedBlockId]);

  const closeSettings = () => {
    setIsSettingsOpen(false);
    selectBlock(null);
  };

  // ============================================
  // API handlers (portal-scoped)
  // ============================================

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = getPagePayload();
      const res = await fetch(api.saveDraft, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
      });
      const saved = await handleWriteResponse(res, "Failed to save");
      if (!saved) return;
      loadPageConfig(saved);
      markSaved();
      setInfo(`Version ${saved.currentVersion} saved`);
    } catch (e) {
      console.error(e);
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
      const res = await fetch(api.saveDraft, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: payload.blocks, seo: payload.seo }),
      });
      const updated = await handleWriteResponse(res, "Failed to apply hotfix");
      if (!updated) return;
      loadPageConfig(updated);
      markSaved();
      setInfo(
        `Hot fix applied to Version ${currentVersion}! Changes are live.`
      );
    } catch (e) {
      console.error(e);
      setError("Unable to apply hotfix. Please try again.");
    } finally {
      setIsHotfixing(false);
    }
  };

  const executePublish = async (
    targetVersion: number,
    formValues: PublishFormValues
  ) => {
    setIsPublishing(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPublishPayload(formValues);
      const res = await fetch(api.publish, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: targetVersion, ...payload }),
      });
      const updated = await handleWriteResponse(res, "Failed to publish");
      if (!updated) return;
      loadPageConfig(updated);
      if (updated.currentVersion) updateUrlVersion(updated.currentVersion);
      setInfo(`Version ${targetVersion} published successfully.`);
      closePublishDialog();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Unable to publish. Please try again."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (publishTargetVersion == null) return;
    await executePublish(publishTargetVersion, publishForm);
  };

  const handleStartNewVersion = async () => {
    if (
      !confirm(
        "Start a new version? This will create a fresh draft based on the latest published version."
      )
    )
      return;
    try {
      const res = await fetch(api.startNewVersion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const config = await handleWriteResponse(
        res,
        "Failed to start new version"
      );
      if (!config) return;
      loadPageConfig(config);
      if (config.currentVersion) updateUrlVersion(config.currentVersion);
      setInfo(`New draft version v${config?.currentVersion} created.`);
    } catch (e) {
      console.error(e);
      setError("Failed to start new version");
    }
  };

  const handleLoadVersion = async (version: number) => {
    try {
      const res = await fetch(api.loadVersion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const config = await handleWriteResponse(res, "Failed to load version");
      if (!config) return;
      loadPageConfig(config);
      setIsVersionHistoryOpen(false);
      updateUrlVersion(config.currentVersion);
      setInfo(`Loaded version v${version}.`);
    } catch (e) {
      console.error(e);
      setError("Unable to load version. Please try again.");
    }
  };

  const handleDeleteVersion = async (version: number) => {
    try {
      const res = await fetch(api.deleteVersion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const config = await handleWriteResponse(res, "Failed to delete version");
      if (!config) return;
      loadPageConfig(config);
      if (config.currentVersion) updateUrlVersion(config.currentVersion);
      setInfo(`Deleted version v${version}.`);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete version. Please try again."
      );
    }
  };

  const handleDuplicateVersion = async (version: number) => {
    try {
      const res = await fetch(api.duplicateVersion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const config = await handleWriteResponse(
        res,
        "Failed to duplicate version"
      );
      if (!config) return;
      loadPageConfig(config);
      setIsVersionHistoryOpen(false);
      if (config.currentVersion) updateUrlVersion(config.currentVersion);
      setInfo(`Duplicated version v${version} as v${config.currentVersion}.`);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to duplicate version. Please try again."
      );
    }
  };

  const handleRenameVersion = async (version: number, label: string) => {
    try {
      const res = await fetch(api.updateVersion, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, label }),
      });
      const config = await handleWriteResponse(res, "Failed to update version");
      if (!config) return;
      loadPageConfig(config);
      const trimmed = label.trim();
      setInfo(
        `Version v${version} renamed to "${trimmed || `Version ${version}`}".`
      );
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update version. Please try again."
      );
    }
  };

  const handleUnpublishVersion = async (version: number) => {
    try {
      const res = await fetch(api.unpublishVersion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const config = await handleWriteResponse(res, "Failed to unpublish");
      if (!config) return;
      loadPageConfig(config);
      if (config.currentVersion) updateUrlVersion(config.currentVersion);
      setInfo(`Version v${version} unpublished.`);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to unpublish version. Please try again."
      );
    }
  };

  // Publish dialog helpers
  const handlePublishFormChange = (
    field: keyof PublishFormValues,
    value: string | number | boolean
  ) => {
    setPublishForm((prev) => ({ ...prev, [field]: value }));
  };

  const openPublishDialog = (version: number) => {
    const target = versions.find((v) => v.version === version);
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
      comment: target?.comment ?? "",
    });
    setIsPublishModalOpen(true);
  };

  const closePublishDialog = () => {
    setIsPublishModalOpen(false);
    setPublishTargetVersion(null);
    setPublishForm(defaultPublishForm);
  };

  const handlePublishButtonClick = () => {
    if (currentVersion > 0) openPublishDialog(currentVersion);
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
            href={portalDetailHref}
            className="flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]"
            title={t("pages.builder.b2bHomeBuilder.backToPortal")}
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
                {t("pages.builder.b2bHomeBuilder.title")}
              </span>
              <span className="rounded bg-[rgba(0,150,136,0.12)] px-2 py-0.5 text-xs font-medium text-[#00796b]">
                {portalSlug}
              </span>
              {currentVersion > 0 && (
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
                    ? t("pages.builder.b2bHomeBuilder.defaultPublished")
                    : isConditionalPublishedVersion
                      ? t("pages.builder.b2bHomeBuilder.conditionalPublished")
                      : isEditingPublishedVersion
                        ? t("common.published")
                        : t("common.draft")}{" "}
                  v{currentVersion}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className={cn(
              iconButtonClass,
              !canUndo && disabledIconButtonClass
            )}
          >
            <RotateCcw className="h-[1.1rem] w-[1.1rem]" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className={cn(
              iconButtonClass,
              !canRedo && disabledIconButtonClass
            )}
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
            {t("pages.builder.b2bHomeBuilder.blockBuilder")}
          </Button>

          {isEditingPublishedVersion ? (
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2 rounded-[0.358rem] border border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#1565c0]"
              onClick={handlePublishButtonClick}
            >
              <Settings2 className="h-4 w-4" />
              {t("pages.builder.b2bHomeBuilder.condition")}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] hover:bg-white"
            onClick={() => setIsVersionHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            {t("pages.builder.b2bHomeBuilder.history")}
          </Button>

          {!isEditingPublishedVersion && (
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
              {t("pages.builder.b2bHomeBuilder.saveDraft")}
            </Button>
          )}

          {isEditingPublishedVersion && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-gradient-to-tr from-[#ff5722] to-[rgba(255,87,34,0.7)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(255,87,34,0.4)]"
              onClick={handleHotfix}
              disabled={isHotfixing || !isDirty || blocks.length === 0}
            >
              {isHotfixing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("pages.builder.b2bHomeBuilder.hotFix")}
            </Button>
          )}

          {!isEditingPublishedVersion && currentVersion > 0 && (
            <Button
              type="button"
              className="flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]"
              onClick={handlePublishButtonClick}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("common.publish")}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] hover:bg-white"
            onClick={handleStartNewVersion}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("pages.builder.b2bHomeBuilder.newVersion")}
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
      {isEditingPublishedVersion && !isDirty && (
        <div className="border-l-4 border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-6 py-3 text-[0.857rem] text-[#1976d2]">
          <strong>
            {t("pages.builder.b2bHomeBuilder.viewingPublishedBanner", { version: String(currentVersion) })}
          </strong>{" "}
          {t("pages.builder.b2bHomeBuilder.viewingPublishedBannerSuffix")} <strong>{t("pages.builder.b2bHomeBuilder.hotFix")}</strong> {t("pages.builder.b2bHomeBuilder.viewingPublishedBannerMiddle")}{" "}
          <strong>{t("pages.builder.b2bHomeBuilder.newVersion")}</strong> {t("pages.builder.b2bHomeBuilder.viewingPublishedBannerEnd")}
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
            <BlockLibrary allowedBlockIds={HOME_PAGE_BLOCKS} />
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
          onRequestPublishVersion={(v) => openPublishDialog(v)}
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

export default function B2BHomeBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <B2BHomeBuilderContent />
    </Suspense>
  );
}
