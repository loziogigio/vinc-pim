"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogBuilderScreen = BlogBuilderScreen;
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
 * Blog-post content builder. Extracted from CS `app/b2b/(builder)/blog-builder/page.tsx`.
 *
 * Transforms from the CS original:
 *  - CS's Suspense wrapper + `useSearchParams` (`?post`, `?locale`, `?back`) move to the
 *    HOST: `postId` and `locale` are now props. The screen asserts both early (return null);
 *    the host owns the "missing params" screen and Suspense.
 *  - `useLanguageStore` + the in-place language `<select>` are DROPPED. `locale` is a
 *    host-controlled prop shown as a static badge; hosts switch languages by linking to
 *    `links.blogBuilder(postId, code)` (the same link BlogListView's Edit-content uses).
 *  - The save/publish/load fetch table -> client methods (`getBlogContent`, `saveBlogDraft`,
 *    `publishBlogContent`), each carrying `?locale=` (handled inside the client).
 *  - LivePreview: CS passed `pageType="home" pageSlug={postId}`; preserved via
 *    `previewUrl({ pageSlug: postId })` (adapter), like the other builders.
 *  - Back-link target -> `links.blogList ?? links.dashboard` (dedicated blog-list link when
 *    the host provides one, else the generic dashboard). `useTranslation` -> `useCmsAdmin().t`.
 *  - `BLOG_BLOCKS` is the default `allowedBlockIds` (now a shared registry export).
 *  - Colors are kept verbatim from the CS builder page.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function BlogBuilderScreen({ postId, locale, allowedBlockIds, }) {
    const { client, t, links, previewUrl, LinkComponent: Link } = (0, adapter_js_1.useCmsAdmin)();
    const allowed = allowedBlockIds ?? registry_js_1.BLOG_BLOCKS;
    const blocks = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.blocks);
    const isDirty = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.isDirty);
    const loadPageConfig = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.loadPageConfig);
    const markSaved = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.markSaved);
    const getPagePayload = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.getPagePayload);
    const selectBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.selectBlock);
    const selectedBlockId = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.selectedBlockId);
    const currentVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentVersion);
    const currentPublishedVersion = (0, pageBuilderStore_js_1.usePageBuilderStore)((s) => s.currentPublishedVersion);
    const [device] = (0, react_1.useState)("desktop");
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    const [isPublishing, setIsPublishing] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [info, setInfo] = (0, react_1.useState)(null);
    const [isSettingsOpen, setIsSettingsOpen] = (0, react_1.useState)(false);
    const [scheduleAt, setScheduleAt] = (0, react_1.useState)("");
    const isPublished = currentPublishedVersion === currentVersion && currentPublishedVersion != null;
    // (Re)load content whenever the post or locale changes.
    (0, react_1.useEffect)(() => {
        if (!postId || !locale) {
            setIsLoading(false);
            return;
        }
        let active = true;
        setIsLoading(true);
        client.getBlogContent(postId, locale)
            .then((cfg) => { if (active)
            loadPageConfig(cfg); })
            .catch(() => { if (active)
            setError(t("pages.blog.builder.failedToSave")); })
            .finally(() => { if (active)
            setIsLoading(false); });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, postId, locale, loadPageConfig]);
    (0, react_1.useEffect)(() => { if (selectedBlockId)
        setIsSettingsOpen(true); }, [selectedBlockId]);
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const payload = getPagePayload();
            const cfg = await client.saveBlogDraft(postId, locale, { blocks: payload.blocks, seo: payload.seo });
            loadPageConfig(cfg);
            markSaved();
            setInfo(t("pages.blog.builder.draftSaved"));
        }
        catch {
            setError(t("pages.blog.builder.failedToSave"));
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
            if (isDirty) {
                const payload = getPagePayload();
                await client.saveBlogDraft(postId, locale, { blocks: payload.blocks, seo: payload.seo });
            }
            const options = scheduleAt ? { scheduled_at: new Date(scheduleAt).toISOString() } : undefined;
            const cfg = await client.publishBlogContent(postId, locale, options);
            loadPageConfig(cfg);
            markSaved();
            setInfo(scheduleAt ? t("pages.blog.builder.scheduled") : t("pages.blog.builder.published"));
        }
        catch {
            setError(t("pages.blog.builder.failedToPublish"));
        }
        finally {
            setIsPublishing(false);
        }
    };
    // Missing-param guards live in the HOST; the screen still asserts them defensively.
    if (!postId || !locale)
        return null;
    if (isLoading) {
        return (0, jsx_runtime_1.jsx)("div", { className: "flex h-[calc(100vh-64px)] items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-[#009688]" }) });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex h-[calc(100vh-64px)] flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex h-[56px] items-center gap-4 border-b border-slate-200 bg-white px-6", children: [(0, jsx_runtime_1.jsx)(Link, { href: links.blogList ?? links.dashboard, title: t("pages.blog.builder.back"), className: "flex h-10 w-10 items-center justify-center rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc]", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-[1rem] font-semibold text-[#5e5873]", children: t("pages.blog.builder.title") }), (0, jsx_runtime_1.jsx)("span", { className: (0, utils_js_1.cn)("rounded px-2 py-0.5 text-xs font-semibold", isPublished ? "bg-[rgba(0,150,136,0.12)] text-[#00796b]" : "bg-[rgba(255,152,0,0.12)] text-[#e65100]"), children: isPublished ? t("pages.blog.status.published") : t("pages.blog.status.draft") }), (0, jsx_runtime_1.jsxs)("span", { className: "ml-2 flex items-center gap-2 text-sm text-[#6e6b7b]", children: [t("pages.blog.builder.language"), ":", (0, jsx_runtime_1.jsx)("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600", children: locale })] }), (0, jsx_runtime_1.jsxs)("div", { className: "ml-auto flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-1 text-xs text-[#6e6b7b]", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-3.5 w-3.5" }), (0, jsx_runtime_1.jsx)("input", { type: "datetime-local", value: scheduleAt, onChange: (e) => setScheduleAt(e.target.value), className: "h-9 rounded-lg border border-[#ebe9f1] px-2 text-sm", title: t("pages.blog.builder.scheduleAt") })] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handleSave, disabled: isSaving || !isDirty, className: "flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]", children: [isSaving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" }), t("pages.blog.builder.saveDraft")] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handlePublish, disabled: isPublishing || blocks.length === 0, className: "flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]", children: [isPublishing ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), scheduleAt ? t("pages.blog.builder.schedule") : t("pages.blog.builder.publish")] })] })] }), error && (0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-red-500 bg-red-50 px-6 py-3 text-[0.857rem] text-red-600", children: error }), info && (0, jsx_runtime_1.jsx)("div", { className: "border-l-4 border-[#009688] bg-[rgba(0,150,136,0.08)] px-6 py-3 text-[0.857rem] text-[#00796b]", children: info }), (0, jsx_runtime_1.jsxs)("main", { className: "flex flex-1 overflow-hidden bg-[#e8eaed]", children: [(0, jsx_runtime_1.jsx)("aside", { className: "h-full w-[100px] overflow-hidden border-r border-[#ebe9f1] bg-white", children: (0, jsx_runtime_1.jsx)(BlockLibrary_js_1.BlockLibrary, { allowedBlockIds: [...allowed] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-1 min-w-0 overflow-hidden", children: [(0, jsx_runtime_1.jsx)("section", { className: "flex h-full w-[360px] min-w-[320px] flex-col overflow-hidden border-r border-[#ebe9f1] bg-[#e8eaed]", children: (0, jsx_runtime_1.jsx)(Canvas_js_1.Canvas, { onOpenSettings: () => setIsSettingsOpen(true), isVisible: true, device: device }) }), (0, jsx_runtime_1.jsx)("section", { className: "flex flex-1 flex-col bg-[#e8eaed] px-6 py-6", children: (0, jsx_runtime_1.jsx)(LivePreview_js_1.LivePreview, { device: device, blocks: blocks, pageSlug: postId, previewUrl: previewUrl({ pageSlug: postId }), isDirty: isDirty }) })] })] }), (0, jsx_runtime_1.jsx)(BlockSettingsModal_js_1.BlockSettingsModal, { open: isSettingsOpen, onClose: () => { setIsSettingsOpen(false); selectBlock(null); } })] }));
}
//# sourceMappingURL=BlogBuilderScreen.js.map