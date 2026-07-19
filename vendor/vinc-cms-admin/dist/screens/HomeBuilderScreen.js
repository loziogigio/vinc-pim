"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeBuilderScreen = HomeBuilderScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const BlockLibrary_js_1 = require("../components/BlockLibrary.js");
const Canvas_js_1 = require("../components/Canvas.js");
const BlockSettingsModal_js_1 = require("../components/BlockSettingsModal.js");
const LivePreview_js_1 = require("../components/LivePreview.js");
const VersionHistory_js_1 = require("../components/VersionHistory.js");
const PublishSettingsDialog_js_1 = require("../components/PublishSettingsDialog.js");
const button_js_1 = require("../ui/button.js");
const utils_js_1 = require("../ui/utils.js");
const pageBuilderStore_js_1 = require("../store/pageBuilderStore.js");
const registry_js_1 = require("../registry.js");
const defaultPublishForm = {
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
const formatDateTimeLocal = (value) => {
    if (!value)
        return undefined;
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime()))
            return undefined;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const h = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        return `${y}-${m}-${d}T${h}:${min}`;
    }
    catch {
        return undefined;
    }
};
const toISOStringFromLocal = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const normalizeTextInput = (value) => {
    if (value == null)
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const parseAddressStates = (value) => {
    if (!value)
        return null;
    const states = value
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
    return states.length > 0 ? states : null;
};
const buildPublishPayload = (form) => {
    const addressStates = parseAddressStates(form.addressStates);
    const attributes = {
        region: normalizeTextInput(form.region),
        language: normalizeTextInput(form.language),
        device: normalizeTextInput(form.device),
    };
    if (addressStates)
        attributes.addressStates = addressStates;
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
/**
 * B2C home page builder screen (versioned). Extracted from CS
 * `app/b2b/(builder)/b2c-home-builder/page.tsx`.
 *
 * The host owns Suspense and guarantees the storefront context (the CS
 * no-storefront guard now lives host-side). `initialVersion` replaces the CS
 * `?v=` search param; the `window.history.replaceState` `?v=` URL sync is kept.
 *
 * @param storefrontLabel Optional storefront name shown in the toolbar badge where
 *   CS used the storefront slug. Omit it and the badge renders empty.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function HomeBuilderScreen({ initialVersion, allowedBlockIds, storefrontLabel, }) {
    const { client, t, links, previewUrl, LinkComponent: Link } = (0, adapter_js_1.useCmsAdmin)();
    const allowed = allowedBlockIds ?? registry_js_1.HOME_PAGE_BLOCKS;
    const urlVersion = initialVersion;
    // Store bindings
    const blocks = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.blocks);
    const isDirty = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.isDirty);
    const history = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.history);
    const loadPageConfig = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.loadPageConfig);
    const markSaved = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.markSaved);
    const getPagePayload = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.getPagePayload);
    const undo = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.undo);
    const redo = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.redo);
    const selectBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.selectBlock);
    const selectedBlockId = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.selectedBlockId);
    const versions = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.versions);
    const currentVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentVersion);
    const currentPublishedVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentPublishedVersion);
    const [device, setDevice] = (0, react_1.useState)("desktop");
    const [sidebarCollapsed, setSidebarCollapsed] = (0, react_1.useState)(false);
    const [isBuilderVisible, setIsBuilderVisible] = (0, react_1.useState)(true);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [info, setInfo] = (0, react_1.useState)(null);
    const [isSettingsOpen, setIsSettingsOpen] = (0, react_1.useState)(false);
    const [isPublishing, setIsPublishing] = (0, react_1.useState)(false);
    const [isPublishModalOpen, setIsPublishModalOpen] = (0, react_1.useState)(false);
    const [publishTargetVersion, setPublishTargetVersion] = (0, react_1.useState)(null);
    const [publishForm, setPublishForm] = (0, react_1.useState)(defaultPublishForm);
    const [isHotfixing, setIsHotfixing] = (0, react_1.useState)(false);
    const [isVersionHistoryOpen, setIsVersionHistoryOpen] = (0, react_1.useState)(false);
    // Derived state
    const currentVersionData = versions.find((v) => v.version === currentVersion);
    const isEditingPublishedVersion = currentVersionData?.status === "published";
    const versionTags = currentVersionData?.tags;
    const hasConditionalSettings = !!(versionTags?.campaign ||
        versionTags?.segment ||
        (versionTags?.attributes &&
            Object.keys(versionTags.attributes).length > 0));
    const isDefaultPublishedVersion = currentVersion === currentPublishedVersion && !hasConditionalSettings;
    const isConditionalPublishedVersion = isEditingPublishedVersion && hasConditionalSettings;
    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;
    const autosaveMessage = (0, react_1.useMemo)(() => {
        if (isLoading)
            return t("common.loading");
        if (isSaving)
            return t("pages.builder.b2cHomeBuilder.savingChanges");
        if (isDirty)
            return t("pages.builder.b2cHomeBuilder.unsavedChanges");
        return t("pages.builder.b2cHomeBuilder.allChangesSaved");
    }, [isLoading, isSaving, isDirty, t]);
    const updateUrlVersion = (version) => {
        const url = new URL(window.location.href);
        if (url.searchParams.get("v") !== String(version)) {
            url.searchParams.set("v", String(version));
            window.history.replaceState(null, "", url.pathname + url.search);
        }
    };
    // Load template on mount
    (0, react_1.useEffect)(() => {
        const loadTemplate = async () => {
            try {
                const config = await client.getHomeTemplate(urlVersion);
                loadPageConfig(config);
                if (config.currentVersion)
                    updateUrlVersion(config.currentVersion);
            }
            catch (err) {
                console.error(err);
                setError("Failed to load storefront home page configuration");
            }
            finally {
                setIsLoading(false);
            }
        };
        loadTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadPageConfig]);
    (0, react_1.useEffect)(() => {
        if (selectedBlockId)
            setIsSettingsOpen(true);
    }, [selectedBlockId]);
    const closeSettings = () => {
        setIsSettingsOpen(false);
        selectBlock(null);
    };
    // ============================================
    // API handlers (storefront-scoped)
    // ============================================
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const payload = getPagePayload();
            const saved = await client.saveHomeDraft({ blocks: payload.blocks, seo: payload.seo });
            loadPageConfig(saved);
            markSaved();
            setInfo(`Version ${saved.currentVersion} saved`);
        }
        catch (e) {
            console.error(e);
            setError("Unable to save. Please try again.");
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleHotfix = async () => {
        setIsHotfixing(true);
        setError(null);
        setInfo(null);
        try {
            const payload = getPagePayload();
            const updated = await client.saveHomeDraft({ blocks: payload.blocks, seo: payload.seo });
            loadPageConfig(updated);
            markSaved();
            setInfo(`Hot fix applied to Version ${currentVersion}! Changes are live.`);
        }
        catch (e) {
            console.error(e);
            setError("Unable to apply hotfix. Please try again.");
        }
        finally {
            setIsHotfixing(false);
        }
    };
    const executePublish = async (targetVersion, formValues) => {
        setIsPublishing(true);
        setError(null);
        setInfo(null);
        try {
            const updated = await client.publishHome({
                version: targetVersion,
                ...buildPublishPayload(formValues),
            });
            loadPageConfig(updated);
            if (updated.currentVersion)
                updateUrlVersion(updated.currentVersion);
            setInfo(`Version ${targetVersion} published successfully.`);
            closePublishDialog();
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Unable to publish. Please try again.");
        }
        finally {
            setIsPublishing(false);
        }
    };
    const handlePublishSubmit = async (event) => {
        event.preventDefault();
        if (publishTargetVersion == null)
            return;
        await executePublish(publishTargetVersion, publishForm);
    };
    const handleStartNewVersion = async () => {
        if (!confirm("Start a new version? This will create a fresh draft based on the latest published version."))
            return;
        try {
            const config = await client.startNewHomeVersion();
            loadPageConfig(config);
            if (config.currentVersion)
                updateUrlVersion(config.currentVersion);
            setInfo(`New draft version v${config?.currentVersion} created.`);
        }
        catch (e) {
            console.error(e);
            setError("Failed to start new version");
        }
    };
    const handleLoadVersion = async (version) => {
        try {
            const config = await client.loadHomeVersion(version);
            loadPageConfig(config);
            setIsVersionHistoryOpen(false);
            updateUrlVersion(config.currentVersion);
            setInfo(`Loaded version v${version}.`);
        }
        catch (e) {
            console.error(e);
            setError("Unable to load version. Please try again.");
        }
    };
    const handleDeleteVersion = async (version) => {
        try {
            const config = await client.deleteHomeVersion(version);
            loadPageConfig(config);
            if (config.currentVersion)
                updateUrlVersion(config.currentVersion);
            setInfo(`Deleted version v${version}.`);
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error
                ? e.message
                : "Unable to delete version. Please try again.");
        }
    };
    const handleDuplicateVersion = async (version) => {
        try {
            const config = await client.duplicateHomeVersion(version);
            loadPageConfig(config);
            setIsVersionHistoryOpen(false);
            if (config.currentVersion)
                updateUrlVersion(config.currentVersion);
            setInfo(`Duplicated version v${version} as v${config.currentVersion}.`);
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error
                ? e.message
                : "Unable to duplicate version. Please try again.");
        }
    };
    const handleRenameVersion = async (version, label) => {
        try {
            const config = await client.renameHomeVersion(version, label);
            loadPageConfig(config);
            const trimmed = label.trim();
            setInfo(`Version v${version} renamed to "${trimmed || `Version ${version}`}".`);
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error
                ? e.message
                : "Unable to update version. Please try again.");
        }
    };
    const handleUnpublishVersion = async (version) => {
        try {
            const config = await client.unpublishHomeVersion(version);
            loadPageConfig(config);
            if (config.currentVersion)
                updateUrlVersion(config.currentVersion);
            setInfo(`Version v${version} unpublished.`);
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error
                ? e.message
                : "Unable to unpublish version. Please try again.");
        }
    };
    // Publish dialog helpers
    const handlePublishFormChange = (field, value) => {
        setPublishForm((prev) => ({ ...prev, [field]: value }));
    };
    const openPublishDialog = (version) => {
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
        if (currentVersion > 0)
            openPublishDialog(currentVersion);
    };
    const iconButtonClass = "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]";
    const disabledIconButtonClass = "cursor-not-allowed opacity-30 hover:bg-transparent";
    const toggleBuilderPanel = () => setIsBuilderVisible((prev) => !prev);
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex h-[calc(100vh-64px)] items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-[#009688]" }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-[calc(100vh-64px)] flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex h-[56px] items-center border-b border-slate-200 bg-white px-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)(Link, { href: links.dashboard, className: "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]", title: "Back to B2C", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSidebarCollapsed((prev) => !prev), className: (0, utils_js_1.cn)(iconButtonClass, sidebarCollapsed && "border border-[#ebe9f1]"), children: sidebarCollapsed ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-[1.1rem] w-[1.1rem]" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Menu, { className: "h-[1.1rem] w-[1.1rem]" })) }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-1", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[1rem] font-semibold text-[#5e5873]", children: "B2C Builder" }), (0, jsx_runtime_1.jsx)("span", { className: "rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700", children: storefrontLabel }), currentVersion > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: (0, utils_js_1.cn)("rounded-[0.358rem] px-[0.714rem] py-[0.286rem] text-[0.786rem] font-semibold", isDefaultPublishedVersion
                                                ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]"
                                                : isConditionalPublishedVersion
                                                    ? "bg-[rgba(33,150,243,0.12)] text-[#1565c0]"
                                                    : isEditingPublishedVersion
                                                        ? "bg-[rgba(156,39,176,0.12)] text-[#7b1fa2]"
                                                        : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"), children: [isDefaultPublishedVersion
                                                    ? t("pages.builder.b2cHomeBuilder.defaultPublished")
                                                    : isConditionalPublishedVersion
                                                        ? t("pages.builder.b2cHomeBuilder.conditionalPublished")
                                                        : isEditingPublishedVersion
                                                            ? t("common.published")
                                                            : t("common.draft"), " ", "v", currentVersion] }))] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "ml-auto flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: undo, disabled: !canUndo, className: (0, utils_js_1.cn)(iconButtonClass, !canUndo && disabledIconButtonClass), children: (0, jsx_runtime_1.jsx)(lucide_react_1.RotateCcw, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: redo, disabled: !canRedo, className: (0, utils_js_1.cn)(iconButtonClass, !canRedo && disabledIconButtonClass), children: (0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-[0.25rem] rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] p-1", children: [
                                    ["desktop", lucide_react_1.Monitor],
                                    ["tablet", lucide_react_1.Tablet],
                                    ["mobile", lucide_react_1.Smartphone],
                                ].map(([mode, Icon]) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDevice(mode), className: (0, utils_js_1.cn)("flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition", device === mode
                                        ? "bg-[#009688] text-white shadow"
                                        : "text-[#5e5873] hover:bg-white"), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }) }, mode))) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", className: (0, utils_js_1.cn)("flex items-center gap-2 rounded-[0.358rem] border px-[1rem] py-[0.571rem] text-[0.95rem] font-medium transition", isBuilderVisible
                                    ? "border-[#ebe9f1] bg-white text-[#5e5873] shadow-sm"
                                    : "border-[#ebe9f1] bg-[#fafafc] text-[#5e5873] hover:bg-white"), onClick: toggleBuilderPanel, children: [isBuilderVisible ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-4 w-4" })), t("pages.builder.b2cHomeBuilder.blockBuilder")] }), isEditingPublishedVersion ? ((0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", className: "flex items-center gap-2 rounded-[0.358rem] border border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#1565c0]", onClick: handlePublishButtonClick, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Settings2, { className: "h-4 w-4" }), t("pages.builder.b2cHomeBuilder.condition")] })) : null, (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", className: "flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] hover:bg-white", onClick: () => setIsVersionHistoryOpen(true), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.History, { className: "h-4 w-4" }), t("pages.builder.b2cHomeBuilder.history")] }), !isEditingPublishedVersion && ((0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", className: "flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]", onClick: handleSave, disabled: isSaving || !isDirty || blocks.length === 0, children: [isSaving ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" })), t("pages.builder.b2cHomeBuilder.saveDraft")] })), isEditingPublishedVersion && ((0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", className: "flex items-center gap-2 rounded-[0.358rem] bg-gradient-to-tr from-[#ff5722] to-[rgba(255,87,34,0.7)] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(255,87,34,0.4)]", onClick: handleHotfix, disabled: isHotfixing || !isDirty || blocks.length === 0, children: [isHotfixing ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" })), t("pages.builder.b2cHomeBuilder.hotFix")] })), !isEditingPublishedVersion && currentVersion > 0 && ((0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", className: "flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]", onClick: handlePublishButtonClick, disabled: isPublishing, children: [isPublishing ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" })), t("common.publish")] })), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", className: "flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] bg-[#fafafc] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-[#5e5873] hover:bg-white", onClick: handleStartNewVersion, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCcw, { className: "h-4 w-4" }), t("pages.builder.b2cHomeBuilder.newVersion")] })] })] }), error && ((0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600", children: error })), info && ((0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]", children: info })), isEditingPublishedVersion && !isDirty && ((0, jsx_runtime_1.jsxs)("div", { className: "border-l-4 border-[#2196f3] bg-[rgba(33,150,243,0.08)] px-6 py-3 text-[0.857rem] text-[#1976d2]", children: [(0, jsx_runtime_1.jsx)("strong", { children: t("pages.builder.b2cHomeBuilder.viewingPublishedBanner", { version: String(currentVersion) }) }), " ", t("pages.builder.b2cHomeBuilder.viewingPublishedBannerSuffix"), " ", (0, jsx_runtime_1.jsx)("strong", { children: t("pages.builder.b2cHomeBuilder.hotFix") }), " ", t("pages.builder.b2cHomeBuilder.viewingPublishedBannerMiddle"), " ", (0, jsx_runtime_1.jsx)("strong", { children: t("pages.builder.b2cHomeBuilder.newVersion") }), " ", t("pages.builder.b2cHomeBuilder.viewingPublishedBannerEnd")] })), (0, jsx_runtime_1.jsxs)("main", { className: "flex flex-1 overflow-hidden bg-[#e8eaed]", children: [(0, jsx_runtime_1.jsx)("aside", { className: (0, utils_js_1.cn)("h-full overflow-hidden border-r border-[#ebe9f1] bg-white transition-all duration-300", sidebarCollapsed ? "w-0" : "w-[100px]"), children: (0, jsx_runtime_1.jsxs)("div", { className: (0, utils_js_1.cn)("flex h-full flex-col", sidebarCollapsed
                                ? "pointer-events-none opacity-0"
                                : "opacity-100"), children: [!sidebarCollapsed && ((0, jsx_runtime_1.jsx)("div", { className: "border-b border-[#ebe9f1] px-2 py-3", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSidebarCollapsed(true), className: "flex w-full items-center justify-center rounded-[5px] border border-[#ebe9f1] bg-white py-2 text-[#6e6b7b] hover:bg-[#fafafc]", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-4 w-4" }) }) })), (0, jsx_runtime_1.jsx)(BlockLibrary_js_1.BlockLibrary, { allowedBlockIds: [...allowed] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-1 min-w-0 overflow-hidden", children: [(0, jsx_runtime_1.jsx)("section", { className: (0, utils_js_1.cn)("flex h-full flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed] transition-all duration-300", isBuilderVisible
                                    ? "w-[360px] min-w-[320px]"
                                    : "w-[60px] min-w-[60px]"), children: (0, jsx_runtime_1.jsx)(Canvas_js_1.Canvas, { onOpenSettings: () => setIsSettingsOpen(true), isVisible: isBuilderVisible, onToggleVisibility: toggleBuilderPanel, device: device }) }), (0, jsx_runtime_1.jsx)("section", { className: "flex flex-1 flex-col bg-[#e8eaed] px-6 py-6", children: (0, jsx_runtime_1.jsx)(LivePreview_js_1.LivePreview, { device: device, blocks: blocks, previewUrl: previewUrl({}), isDirty: isDirty }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "fixed bottom-6 right-6 flex items-center gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-3 text-[0.857rem] text-[#5e5873] shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]", children: [(0, jsx_runtime_1.jsx)("span", { className: "h-2 w-2 animate-pulse rounded-full bg-[#009688]" }), (0, jsx_runtime_1.jsx)("span", { children: autosaveMessage })] }), (0, jsx_runtime_1.jsx)(BlockSettingsModal_js_1.BlockSettingsModal, { open: isSettingsOpen, onClose: closeSettings }), isVersionHistoryOpen && ((0, jsx_runtime_1.jsx)(VersionHistory_js_1.VersionHistory, { versions: versions, currentVersion: currentVersion, currentPublishedVersion: currentPublishedVersion, isDirty: isDirty, onLoadVersion: handleLoadVersion, onDelete: handleDeleteVersion, onDuplicate: handleDuplicateVersion, onRenameVersion: handleRenameVersion, onRequestPublishVersion: (v) => openPublishDialog(v), onUnpublishVersion: handleUnpublishVersion, onClose: () => setIsVersionHistoryOpen(false) })), (0, jsx_runtime_1.jsx)(PublishSettingsDialog_js_1.PublishSettingsDialog, { open: isPublishModalOpen, version: publishTargetVersion, values: publishForm, isSubmitting: isPublishing, onChange: handlePublishFormChange, onClose: closePublishDialog, onSubmit: handlePublishSubmit })] }));
}
//# sourceMappingURL=HomeBuilderScreen.js.map