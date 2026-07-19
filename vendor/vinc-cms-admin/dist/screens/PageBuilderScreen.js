"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageBuilderScreen = PageBuilderScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const BlockLibrary_js_1 = require("../components/BlockLibrary.js");
const Canvas_js_1 = require("../components/Canvas.js");
const BlockSettingsModal_js_1 = require("../components/BlockSettingsModal.js");
const LivePreview_js_1 = require("../components/LivePreview.js");
const button_js_1 = require("../ui/button.js");
const utils_js_1 = require("../ui/utils.js");
const pageBuilderStore_js_1 = require("../store/pageBuilderStore.js");
const registry_js_1 = require("../registry.js");
/**
 * Custom B2C page builder screen. Extracted from CS
 * `app/b2b/(builder)/b2c-page-builder/page.tsx`.
 *
 * The host owns Suspense and guarantees a non-empty `pageSlug` (the missing-param
 * guard lived in the CS page and now lives in the host wrapper).
 *
 * @param storefrontLabel Optional storefront name shown in the toolbar badge where
 *   CS used the storefront slug. Omit it and the badge renders empty.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function PageBuilderScreen({ pageSlug, allowedBlockIds, storefrontLabel, }) {
    const { client, links, previewUrl, LinkComponent: Link } = (0, adapter_js_1.useCmsAdmin)();
    const allowed = allowedBlockIds ?? registry_js_1.PAGE_BLOCKS;
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
    const currentVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentVersion);
    const currentPublishedVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentPublishedVersion);
    const [device, setDevice] = (0, react_1.useState)("desktop");
    const [sidebarCollapsed, setSidebarCollapsed] = (0, react_1.useState)(false);
    const [isBuilderVisible, setIsBuilderVisible] = (0, react_1.useState)(true);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [isPublishing, setIsPublishing] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [info, setInfo] = (0, react_1.useState)(null);
    const [isSettingsOpen, setIsSettingsOpen] = (0, react_1.useState)(false);
    const isPublished = currentPublishedVersion === currentVersion && currentPublishedVersion != null;
    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;
    const autosaveMessage = (0, react_1.useMemo)(() => {
        if (isLoading)
            return "Loading...";
        if (isSaving)
            return "Saving...";
        if (isDirty)
            return "Unsaved changes";
        return "All changes saved";
    }, [isLoading, isSaving, isDirty]);
    // Load template on mount
    (0, react_1.useEffect)(() => {
        const loadTemplate = async () => {
            try {
                const config = await client.getPageTemplate(pageSlug);
                loadPageConfig(config);
            }
            catch (err) {
                console.error(err);
                setError("Failed to load page template");
            }
            finally {
                setIsLoading(false);
            }
        };
        loadTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadPageConfig, pageSlug]);
    (0, react_1.useEffect)(() => {
        if (selectedBlockId)
            setIsSettingsOpen(true);
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
            const saved = await client.savePageDraft(pageSlug, { blocks: payload.blocks, seo: payload.seo });
            loadPageConfig(saved);
            markSaved();
            setInfo("Draft saved");
        }
        catch (e) {
            console.error(e);
            setError("Unable to save. Please try again.");
        }
        finally {
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
                try {
                    await client.savePageDraft(pageSlug, { blocks: payload.blocks, seo: payload.seo });
                }
                catch {
                    throw new Error("Failed to save before publishing");
                }
            }
            const updated = await client.publishPage(pageSlug);
            loadPageConfig(updated);
            markSaved();
            setInfo("Page published successfully!");
        }
        catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Unable to publish.");
        }
        finally {
            setIsPublishing(false);
        }
    };
    const iconButtonClass = "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]";
    const disabledIconButtonClass = "cursor-not-allowed opacity-30 hover:bg-transparent";
    const toggleBuilderPanel = () => setIsBuilderVisible((prev) => !prev);
    if (!pageSlug)
        return null;
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex h-[calc(100vh-64px)] items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-[#009688]" }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-[calc(100vh-64px)] flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex h-[56px] items-center border-b border-slate-200 bg-white px-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)(Link, { href: links.pagesList, className: "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] transition hover:bg-[#fafafc]", title: "Back to Pages", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSidebarCollapsed((prev) => !prev), className: (0, utils_js_1.cn)(iconButtonClass, sidebarCollapsed && "border border-[#ebe9f1]"), children: sidebarCollapsed ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-[1.1rem] w-[1.1rem]" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Menu, { className: "h-[1.1rem] w-[1.1rem]" })) }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-1", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[1rem] font-semibold text-[#5e5873]", children: "Page Builder" }), (0, jsx_runtime_1.jsx)("span", { className: "rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700", children: storefrontLabel }), (0, jsx_runtime_1.jsxs)("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600", children: ["/", pageSlug] }), (0, jsx_runtime_1.jsx)("span", { className: (0, utils_js_1.cn)("rounded-[0.358rem] px-[0.714rem] py-[0.286rem] text-[0.786rem] font-semibold", isPublished
                                                ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]"
                                                : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"), children: isPublished ? "Published" : "Draft" })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "ml-auto flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: undo, disabled: !canUndo, className: (0, utils_js_1.cn)(iconButtonClass, !canUndo && disabledIconButtonClass), children: (0, jsx_runtime_1.jsx)(lucide_react_1.RotateCcw, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: redo, disabled: !canRedo, className: (0, utils_js_1.cn)(iconButtonClass, !canRedo && disabledIconButtonClass), children: (0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-[0.25rem] rounded-[0.428rem] border border-[#ebe9f1] bg-[#fafafc] p-1", children: [
                                    ["desktop", lucide_react_1.Monitor],
                                    ["tablet", lucide_react_1.Tablet],
                                    ["mobile", lucide_react_1.Smartphone],
                                ].map(([mode, Icon]) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setDevice(mode), className: (0, utils_js_1.cn)("flex h-[38px] w-[38px] items-center justify-center rounded-[5px] transition", device === mode
                                        ? "bg-[#009688] text-white shadow"
                                        : "text-[#5e5873] hover:bg-white"), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }) }, mode))) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", className: (0, utils_js_1.cn)("flex items-center gap-2 rounded-[0.358rem] border px-[1rem] py-[0.571rem] text-[0.95rem] font-medium transition", isBuilderVisible
                                    ? "border-[#ebe9f1] bg-white text-[#5e5873] shadow-sm"
                                    : "border-[#ebe9f1] bg-[#fafafc] text-[#5e5873] hover:bg-white"), onClick: toggleBuilderPanel, children: [isBuilderVisible ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-4 w-4" })), "Block Builder"] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", className: "flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]", onClick: handleSave, disabled: isSaving || !isDirty || blocks.length === 0, children: [isSaving ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" })), "Save Draft"] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", className: "flex items-center gap-2 rounded-[0.358rem] bg-[#009688] px-[1rem] py-[0.571rem] text-[0.95rem] font-medium text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] hover:bg-[#00796b]", onClick: handlePublish, disabled: isPublishing || blocks.length === 0, children: [isPublishing ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" })), "Publish"] })] })] }), error && ((0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600", children: error })), info && ((0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]", children: info })), (0, jsx_runtime_1.jsxs)("main", { className: "flex flex-1 overflow-hidden bg-[#e8eaed]", children: [(0, jsx_runtime_1.jsx)("aside", { className: (0, utils_js_1.cn)("h-full overflow-hidden border-r border-[#ebe9f1] bg-white transition-all duration-300", sidebarCollapsed ? "w-0" : "w-[100px]"), children: (0, jsx_runtime_1.jsxs)("div", { className: (0, utils_js_1.cn)("flex h-full flex-col", sidebarCollapsed
                                ? "pointer-events-none opacity-0"
                                : "opacity-100"), children: [!sidebarCollapsed && ((0, jsx_runtime_1.jsx)("div", { className: "border-b border-[#ebe9f1] px-2 py-3", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSidebarCollapsed(true), className: "flex w-full items-center justify-center rounded-[5px] border border-[#ebe9f1] bg-white py-2 text-[#6e6b7b] hover:bg-[#fafafc]", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-4 w-4" }) }) })), (0, jsx_runtime_1.jsx)(BlockLibrary_js_1.BlockLibrary, { allowedBlockIds: [...allowed] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-1 min-w-0 overflow-hidden", children: [(0, jsx_runtime_1.jsx)("section", { className: (0, utils_js_1.cn)("flex h-full flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed] transition-all duration-300", isBuilderVisible
                                    ? "w-[360px] min-w-[320px]"
                                    : "w-[60px] min-w-[60px]"), children: (0, jsx_runtime_1.jsx)(Canvas_js_1.Canvas, { onOpenSettings: () => setIsSettingsOpen(true), isVisible: isBuilderVisible, onToggleVisibility: toggleBuilderPanel, device: device }) }), (0, jsx_runtime_1.jsx)("section", { className: "flex flex-1 flex-col bg-[#e8eaed] px-6 py-6", children: (0, jsx_runtime_1.jsx)(LivePreview_js_1.LivePreview, { device: device, blocks: blocks, pageSlug: pageSlug, previewUrl: previewUrl({ pageSlug }), isDirty: isDirty }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "fixed bottom-6 right-6 flex items-center gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-3 text-[0.857rem] text-[#5e5873] shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]", children: [(0, jsx_runtime_1.jsx)("span", { className: "h-2 w-2 animate-pulse rounded-full bg-[#009688]" }), (0, jsx_runtime_1.jsx)("span", { children: autosaveMessage })] }), (0, jsx_runtime_1.jsx)(BlockSettingsModal_js_1.BlockSettingsModal, { open: isSettingsOpen, onClose: closeSettings })] }));
}
//# sourceMappingURL=PageBuilderScreen.js.map