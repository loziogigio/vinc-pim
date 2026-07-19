"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockSettingsModal = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
const pageBuilderStore_js_1 = require("../store/pageBuilderStore.js");
const registry_js_1 = require("../registry.js");
const YouTubeBlockSettings_js_1 = require("./YouTubeBlockSettings.js");
const MediaImageBlockSettings_js_1 = require("./MediaImageBlockSettings.js");
const HeroCarouselSettings_js_1 = require("./HeroCarouselSettings.js");
const HeroWithWidgetsSettings_js_1 = require("./HeroWithWidgetsSettings.js");
const MediaCarouselSettings_js_1 = require("./MediaCarouselSettings.js");
const ProductCarouselSettings_js_1 = require("./ProductCarouselSettings.js");
const ProductGallerySettings_js_1 = require("./ProductGallerySettings.js");
const ProductDataTableSettings_js_1 = require("./ProductDataTableSettings.js");
const FormBlockSettings_js_1 = require("./FormBlockSettings.js");
const ZoneSelector_js_1 = require("./ZoneSelector.js");
const RichTextEditor_js_1 = require("./RichTextEditor.js");
const lucide_react_2 = require("lucide-react");
const BLOCKS_WITH_CUSTOM_TITLE = new Set(["media-image", "carousel-hero", "form-contact"]);
/** Recommended image dimensions per block type and layout */
const DIMENSION_HINTS = {
    "hero-full-width": { fullWidth: "1920 × 600 px", container: "1200 × 600 px" },
    "hero-split": { fullWidth: "800 × 600 px", container: "800 × 600 px" },
    "carousel-hero": { fullWidth: "1920 × 600 px", container: "1200 × 600 px" },
    "hero-with-widgets": { fullWidth: "1920 × 600 px", container: "1200 × 600 px" },
    "media-image": { fullWidth: "1920 × auto", container: "1200 × auto" },
    "carousel-promo": { fullWidth: "1920 × 500 px", container: "1200 × 500 px" },
    "carousel-brand": { fullWidth: "300 × 200 px", container: "300 × 200 px" },
    "carousel-flyer": { fullWidth: "800 × 1100 px", container: "800 × 1100 px" },
};
const cloneConfig = (config) => JSON.parse(JSON.stringify(config));
const BlockSettingsModal = ({ open, onClose }) => {
    const blocks = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.blocks);
    const selectedBlockId = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.selectedBlockId);
    const updateBlockConfig = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.updateBlockConfig);
    const selectBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.selectBlock);
    const pageDetails = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.pageDetails);
    const selectedBlock = (0, react_1.useMemo)(() => blocks.find((block) => block.id === selectedBlockId) ?? null, [blocks, selectedBlockId]);
    const skipStandardTitleField = selectedBlock ? BLOCKS_WITH_CUSTOM_TITLE.has(selectedBlock.type) : false;
    // Check if we're editing a product detail page (only those need zone placement)
    const isProductDetailPage = pageDetails.slug === "product-detail" ||
        pageDetails.slug.startsWith("product-detail-") ||
        pageDetails.slug.startsWith("sku-") ||
        pageDetails.slug.startsWith("parentSku-") ||
        pageDetails.slug.startsWith("standard-");
    const [draft, setDraft] = (0, react_1.useState)(() => selectedBlock ? cloneConfig(selectedBlock.config) : null);
    const [hasLocalChanges, setHasLocalChanges] = (0, react_1.useState)(false);
    const [advancedDraft, setAdvancedDraft] = (0, react_1.useState)("");
    const [jsonError, setJsonError] = (0, react_1.useState)(null);
    const [uploadError, setUploadError] = (0, react_1.useState)(null);
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    const backgroundFileInputRef = (0, react_1.useRef)(null);
    const imageFileInputRef = (0, react_1.useRef)(null);
    // Layout state (full-width vs container)
    const [layout, setLayout] = (0, react_1.useState)(selectedBlock?.layout || "full-width");
    // Zone placement state
    const [zone, setZone] = (0, react_1.useState)(selectedBlock?.zone || "zone3");
    const [tabLabel, setTabLabel] = (0, react_1.useState)(selectedBlock?.tabLabel || "");
    // Title display controls
    const [showTitle, setShowTitle] = (0, react_1.useState)(selectedBlock?.showTitle ?? true);
    const [titleAlignment, setTitleAlignment] = (0, react_1.useState)(selectedBlock?.titleAlignment || "left");
    (0, react_1.useEffect)(() => {
        if (selectedBlock) {
            const cloned = cloneConfig(selectedBlock.config);
            setDraft(cloned);
            setAdvancedDraft(JSON.stringify(cloned, null, 2));
            setLayout(selectedBlock.layout || "full-width");
            setZone(selectedBlock.zone || "zone3");
            setTabLabel(selectedBlock.tabLabel || "");
            setShowTitle(selectedBlock.showTitle ?? true);
            setTitleAlignment(selectedBlock.titleAlignment || "left");
        }
        else {
            setDraft(null);
            setAdvancedDraft("");
            setLayout("full-width");
            setZone("zone3");
            setTabLabel("");
            setShowTitle(true);
            setTitleAlignment("left");
        }
        setHasLocalChanges(false);
        setJsonError(null);
        setUploadError(null);
    }, [selectedBlock, open]);
    const closeModal = () => {
        setUploadError(null);
        setJsonError(null);
        onClose();
    };
    const updateDraft = (updater) => {
        setDraft((previous) => {
            if (!previous)
                return previous;
            const next = updater(previous);
            if (next !== previous) {
                setHasLocalChanges(true);
                setJsonError(null);
                setAdvancedDraft(JSON.stringify(next, null, 2));
            }
            return next;
        });
    };
    const handleApply = () => {
        if (!selectedBlock || !draft)
            return;
        console.log('[BlockSettingsModal] Applying settings - zone:', zone, 'tabLabel:', tabLabel);
        console.log('[BlockSettingsModal] Draft title:', draft?.title);
        // Update config
        updateBlockConfig(selectedBlock.id, draft);
        // Update layout, zone, and tabLabel directly (since updateBlockConfig doesn't handle these)
        pageBuilderStore_js_1.usePageBuilderStore.setState((state) => ({
            blocks: state.blocks.map((block) => block.id === selectedBlock.id
                ? {
                    ...block,
                    layout,
                    zone,
                    tabLabel: zone === "zone3" && tabLabel.trim().length > 0 ? tabLabel.trim() : undefined,
                    showTitle,
                    titleAlignment,
                }
                : block),
            isDirty: true
        }));
        setHasLocalChanges(false);
        closeModal();
    };
    const template = selectedBlock ? (0, registry_js_1.getBlockTemplate)(selectedBlock.type) : null;
    const rawCta = draft?.cta;
    const cta = rawCta && typeof rawCta === "object" ? rawCta : null;
    const hasTitle = draft ? typeof draft.title === "string" : false;
    const hasSubtitle = draft ? typeof draft.subtitle === "string" : false;
    const hasBackgroundColor = draft ? typeof draft.backgroundColor === "string" : false;
    const rawBackground = draft?.background;
    const background = rawBackground && typeof rawBackground === "object"
        ? rawBackground
        : null;
    const hasImage = draft ? typeof draft.image === "string" : false;
    const hasCollection = draft ? typeof draft.collection === "string" : false;
    const hasLimit = draft ? typeof draft.limit === "number" : false;
    const hasColumns = draft?.columns && typeof draft.columns === "object";
    const hasContent = draft ? typeof draft.content === "string" : false;
    const isCustomHtmlBlock = selectedBlock ? selectedBlock.type === "content-custom-html" : false;
    const customHtmlValue = isCustomHtmlBlock && draft && typeof draft.html === "string" ? draft.html : "";
    const hasFeatures = draft ? Array.isArray(draft.features) : false;
    const hasTestimonials = draft ? Array.isArray(draft.testimonials) : false;
    const columnsRecord = hasColumns ? draft?.columns : null;
    const titleValue = hasTitle ? draft?.title : "";
    const subtitleValue = hasSubtitle ? draft?.subtitle : "";
    const contentValue = hasContent ? draft?.content : "";
    const backgroundColorValue = hasBackgroundColor ? draft?.backgroundColor : "#ffffff";
    const ctaText = cta && typeof cta.text === "string" ? cta.text : "";
    const ctaLink = cta && typeof cta.link === "string" ? cta.link : "";
    const ctaStyle = cta && typeof cta.style === "string" ? cta.style : "primary";
    const backgroundSrc = background && typeof background.src === "string" ? background.src : "";
    const backgroundAlt = background && typeof background.alt === "string" ? background.alt : "";
    const imageValue = hasImage ? draft?.image : "";
    const collectionValue = hasCollection ? draft?.collection : "";
    const limitValue = hasLimit ? draft?.limit : 0;
    const featureCount = hasFeatures && draft?.features ? draft.features.length : 0;
    const testimonialCount = hasTestimonials && draft?.testimonials ? draft.testimonials.length : 0;
    const blockLabel = template?.label ?? selectedBlock?.type.replace(/-/g, " ");
    const blockIdSnippet = selectedBlock?.id.slice(0, 12) ?? "";
    const handleUpload = async (file, applyUrl) => {
        setUploadError(null);
        if (!file) {
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setUploadError("File size must be 20MB or smaller.");
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/uploads", {
                method: "POST",
                body: formData
            });
            if (!response.ok) {
                const payload = (await response.json().catch(() => null));
                throw new Error(payload?.error ?? "Failed to upload file.");
            }
            const result = (await response.json());
            applyUrl(result.url);
        }
        catch (error) {
            console.error("Upload failed", error);
            setUploadError(error instanceof Error ? error.message : "Failed to upload file.");
        }
        finally {
            setIsUploading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        if (!open) {
            selectBlock(null);
        }
    }, [open, selectBlock]);
    if (!open || !selectedBlock || !draft) {
        return null;
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm", children: [(0, jsx_runtime_1.jsx)("div", { role: "presentation", className: "absolute inset-0", onClick: closeModal, "aria-hidden": "true" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("header", { className: "flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-900", children: "Block Settings" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-500", children: [blockLabel, " \u2022 ", (0, jsx_runtime_1.jsx)("span", { className: "font-mono text-xs text-slate-400", children: blockIdSnippet })] })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeModal, className: "rounded-full p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700", "aria-label": "Close settings", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 overflow-y-auto px-6 py-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [isProductDetailPage && ((0, jsx_runtime_1.jsx)("div", { className: "pb-6 border-b border-slate-200", children: (0, jsx_runtime_1.jsx)(ZoneSelector_js_1.ZoneSelector, { zone: zone, tabLabel: tabLabel, onChange: (newZone, newTabLabel) => {
                                            setZone(newZone);
                                            setTabLabel(newTabLabel || "");
                                            setHasLocalChanges(true);
                                        } }) })), (0, jsx_runtime_1.jsxs)("div", { className: "pb-6 border-b border-slate-200", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Layout" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid grid-cols-2 gap-3", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => { setLayout("full-width"); setHasLocalChanges(true); }, className: `flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm transition ${layout === "full-width"
                                                        ? "border-orange-500 bg-orange-50 text-orange-700"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_2.Maximize, { className: "h-5 w-5" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: "Full Width" }), (0, jsx_runtime_1.jsx)("span", { className: "text-[0.7rem] text-slate-500", children: "Edge-to-edge" })] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => { setLayout("container"); setHasLocalChanges(true); }, className: `flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm transition ${layout === "container"
                                                        ? "border-orange-500 bg-orange-50 text-orange-700"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_2.AlignCenter, { className: "h-5 w-5" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: "Container" }), (0, jsx_runtime_1.jsx)("span", { className: "text-[0.7rem] text-slate-500", children: "Max 1200px centered" })] })] }), DIMENSION_HINTS[selectedBlock.type] && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-500", children: ["Recommended image size:", " ", (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-slate-600", children: layout === "full-width"
                                                        ? DIMENSION_HINTS[selectedBlock.type].fullWidth
                                                        : DIMENSION_HINTS[selectedBlock.type].container })] }))] }), hasTitle && ((0, jsx_runtime_1.jsxs)("div", { className: "pb-6 border-b border-slate-200 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Show title" }), (0, jsx_runtime_1.jsx)("button", { type: "button", role: "switch", "aria-checked": showTitle, onClick: () => { setShowTitle(!showTitle); setHasLocalChanges(true); }, className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showTitle ? "bg-orange-500" : "bg-slate-300"}`, children: (0, jsx_runtime_1.jsx)("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showTitle ? "translate-x-6" : "translate-x-1"}` }) })] }), showTitle && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Title alignment" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 grid grid-cols-3 gap-2", children: ["left", "center", "right"].map((align) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => { setTitleAlignment(align); setHasLocalChanges(true); }, className: `flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm transition ${titleAlignment === align
                                                            ? "border-orange-500 bg-orange-50 text-orange-700"
                                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`, children: [align === "left" ? (0, jsx_runtime_1.jsx)(lucide_react_2.AlignLeft, { className: "h-4 w-4" }) :
                                                                align === "center" ? (0, jsx_runtime_1.jsx)(lucide_react_2.AlignCenter, { className: "h-4 w-4" }) :
                                                                    (0, jsx_runtime_1.jsx)(lucide_react_2.AlignRight, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs capitalize", children: align })] }, align))) })] }))] })), selectedBlock.type === "youtubeEmbed" ? ((0, jsx_runtime_1.jsx)(YouTubeBlockSettings_js_1.YouTubeBlockSettings, { config: draft, onChange: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } })) : null, selectedBlock.type === "media-image" ? ((0, jsx_runtime_1.jsx)(MediaImageBlockSettings_js_1.MediaImageBlockSettings, { config: draft, onChange: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } })) : null, selectedBlock.type === "product-data-table" ? ((0, jsx_runtime_1.jsx)(ProductDataTableSettings_js_1.ProductDataTableSettings, { config: draft, onChange: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } })) : null, selectedBlock.type === "form-contact" ? ((0, jsx_runtime_1.jsx)(FormBlockSettings_js_1.FormBlockSettings, { config: draft, onChange: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } })) : null, selectedBlock.type === "hero-with-widgets" ? ((0, jsx_runtime_1.jsx)(HeroWithWidgetsSettings_js_1.HeroWithWidgetsSettings, { blockId: selectedBlock.id, config: draft, onSave: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                    } }, selectedBlock.id)) : null, selectedBlock.type === "carousel-hero" ? ((0, jsx_runtime_1.jsx)(HeroCarouselSettings_js_1.HeroCarouselSettings, { blockId: selectedBlock.id, config: draft, onSave: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } }, selectedBlock.id)) : null, ["carousel-promo", "carousel-brand", "carousel-flyer"].includes(selectedBlock.type) ? ((0, jsx_runtime_1.jsx)(MediaCarouselSettings_js_1.MediaCarouselSettings, { blockId: selectedBlock.id, config: draft, onSave: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } }, selectedBlock.id)) : null, selectedBlock.type === "carousel-products" ? ((0, jsx_runtime_1.jsx)(ProductCarouselSettings_js_1.ProductCarouselSettings, { blockId: selectedBlock.id, config: draft, onSave: (newConfig) => {
                                        console.log('[BlockSettingsModal] Received onSave from ProductCarouselSettings, title:', newConfig?.title);
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } }, selectedBlock.id)) : null, selectedBlock.type === "carousel-gallery" ? ((0, jsx_runtime_1.jsx)(ProductGallerySettings_js_1.ProductGallerySettings, { blockId: selectedBlock.id, config: draft, onSave: (newConfig) => {
                                        setDraft(newConfig);
                                        setHasLocalChanges(true);
                                        setAdvancedDraft(JSON.stringify(newConfig, null, 2));
                                    } }, selectedBlock.id)) : null, hasTitle && !skipStandardTitleField && showTitle ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Title" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: titleValue, onChange: (event) => updateDraft((current) => ({ ...current, title: event.target.value })), className: "mt-2" })] })) : null, hasSubtitle && showTitle ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Subtitle" }), (0, jsx_runtime_1.jsx)("textarea", { value: subtitleValue, onChange: (event) => updateDraft((current) => ({ ...current, subtitle: event.target.value })), rows: 3, className: "mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" })] })) : null, hasContent ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Rich content" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2", children: (0, jsx_runtime_1.jsx)(RichTextEditor_js_1.RichTextEditor, { content: contentValue, onChange: (html) => updateDraft((current) => ({ ...current, content: html })), placeholder: "Type your content here..." }) })] })) : null, isCustomHtmlBlock ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Custom HTML markup" }), (0, jsx_runtime_1.jsx)("textarea", { value: customHtmlValue, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                html: event.target.value
                                            })), rows: 12, className: "mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500", placeholder: "Paste complete HTML snippet here", spellCheck: false }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-xs text-slate-500", children: "The markup renders exactly as provided\u2014no additional wrappers or classes are added." })] })) : null, cta ? ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Button text" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: ctaText, onChange: (event) => updateDraft((current) => {
                                                        const existing = current.cta && typeof current.cta === "object"
                                                            ? current.cta
                                                            : {};
                                                        return {
                                                            ...current,
                                                            cta: { ...existing, text: event.target.value }
                                                        };
                                                    }), className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Button link" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: ctaLink, onChange: (event) => updateDraft((current) => {
                                                        const existing = current.cta && typeof current.cta === "object"
                                                            ? current.cta
                                                            : {};
                                                        return {
                                                            ...current,
                                                            cta: { ...existing, link: event.target.value }
                                                        };
                                                    }), className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Button style" }), (0, jsx_runtime_1.jsxs)("select", { value: ctaStyle, onChange: (event) => updateDraft((current) => {
                                                        const existing = current.cta && typeof current.cta === "object"
                                                            ? current.cta
                                                            : {};
                                                        return {
                                                            ...current,
                                                            cta: { ...existing, style: event.target.value }
                                                        };
                                                    }), className: "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", children: [(0, jsx_runtime_1.jsx)("option", { value: "primary", children: "Primary" }), (0, jsx_runtime_1.jsx)("option", { value: "secondary", children: "Secondary" }), (0, jsx_runtime_1.jsx)("option", { value: "outline", children: "Outline" })] })] })] })) : null, hasBackgroundColor ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Background color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: backgroundColorValue, onChange: (event) => updateDraft((current) => ({
                                                        ...current,
                                                        backgroundColor: event.target.value
                                                    })), className: "h-12 w-16 cursor-pointer rounded-lg border border-slate-300" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: backgroundColorValue, onChange: (event) => updateDraft((current) => ({
                                                        ...current,
                                                        backgroundColor: event.target.value
                                                    })) })] })] })) : null, background ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [backgroundSrc ? ((0, jsx_runtime_1.jsxs)("div", { className: "relative overflow-hidden rounded-xl border border-slate-200", children: [(0, jsx_runtime_1.jsx)("img", { src: backgroundSrc, alt: backgroundAlt || "Background preview", className: "h-48 w-full object-cover" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100", children: (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "secondary", size: "sm", onClick: () => backgroundFileInputRef.current?.click(), disabled: isUploading, children: isUploading ? "Uploading…" : "Replace image" }) })] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-orange-500", onClick: () => backgroundFileInputRef.current?.click(), onDragOver: (event) => event.preventDefault(), onDrop: (event) => {
                                                event.preventDefault();
                                                const file = event.dataTransfer.files?.[0];
                                                if (file) {
                                                    const derivedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
                                                    void handleUpload(file, (url) => updateDraft((current) => {
                                                        const existingBackground = current.background && typeof current.background === "object"
                                                            ? current.background
                                                            : {};
                                                        return {
                                                            ...current,
                                                            background: {
                                                                ...existingBackground,
                                                                src: url,
                                                                alt: typeof existingBackground.alt === "string" &&
                                                                    existingBackground.alt.trim().length > 0
                                                                    ? existingBackground.alt
                                                                    : derivedAlt
                                                            }
                                                        };
                                                    }));
                                                }
                                            }, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Image, { className: "mb-3 h-10 w-10 text-slate-400" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-600", children: isUploading ? "Uploading…" : "Click to upload or drag and drop" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-500", children: "PNG, JPG up to 20MB" })] })), (0, jsx_runtime_1.jsx)("input", { ref: backgroundFileInputRef, type: "file", accept: "image/*", className: "hidden", onChange: (event) => {
                                                const file = event.target.files?.[0];
                                                if (file) {
                                                    const derivedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
                                                    void handleUpload(file, (url) => updateDraft((current) => {
                                                        const existingBackground = current.background && typeof current.background === "object"
                                                            ? current.background
                                                            : {};
                                                        return {
                                                            ...current,
                                                            background: {
                                                                ...existingBackground,
                                                                src: url,
                                                                alt: typeof existingBackground.alt === "string" &&
                                                                    existingBackground.alt.trim().length > 0
                                                                    ? existingBackground.alt
                                                                    : derivedAlt
                                                            }
                                                        };
                                                    }));
                                                }
                                                event.target.value = "";
                                            } }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: backgroundSrc, onChange: (event) => updateDraft((current) => {
                                                const existingBackground = current.background && typeof current.background === "object"
                                                    ? current.background
                                                    : {};
                                                return {
                                                    ...current,
                                                    background: { ...existingBackground, src: event.target.value }
                                                };
                                            }), placeholder: "https://" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: backgroundAlt, onChange: (event) => updateDraft((current) => {
                                                const existingBackground = current.background && typeof current.background === "object"
                                                    ? current.background
                                                    : {};
                                                return {
                                                    ...current,
                                                    background: { ...existingBackground, alt: event.target.value }
                                                };
                                            }), placeholder: "Describe the image (alt text)" }), uploadError ? (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-red-500", children: uploadError }) : null] })) : null, hasImage ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Image URL" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(input_js_1.Input, { value: imageValue, onChange: (event) => updateDraft((current) => ({ ...current, image: event.target.value })) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "outline", onClick: () => imageFileInputRef.current?.click(), disabled: isUploading, children: isUploading ? "Uploading…" : "Upload" }), (0, jsx_runtime_1.jsx)("input", { ref: imageFileInputRef, type: "file", accept: "image/*", className: "hidden", onChange: (event) => {
                                                        const file = event.target.files?.[0];
                                                        if (file) {
                                                            void handleUpload(file, (url) => updateDraft((current) => ({ ...current, image: url })));
                                                        }
                                                        event.target.value = "";
                                                    } })] })] })) : null, hasCollection ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Collection handle" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: collectionValue, onChange: (event) => updateDraft((current) => ({ ...current, collection: event.target.value })), className: "mt-2" })] })) : null, hasLimit ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Items limit" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", value: limitValue, min: 1, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                limit: Number.parseInt(event.target.value, 10) || 0
                                            })), className: "mt-2" })] })) : null, hasColumns ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Columns per device" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 grid grid-cols-3 gap-3", children: ["mobile", "tablet", "desktop"].map((breakpoint) => {
                                                const columnValue = columnsRecord && typeof columnsRecord[breakpoint] === "number"
                                                    ? columnsRecord[breakpoint]
                                                    : 0;
                                                return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-semibold uppercase text-slate-500", children: breakpoint }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", value: columnValue, min: 1, max: 6, onChange: (event) => updateDraft((current) => {
                                                                const existingColumns = current.columns && typeof current.columns === "object"
                                                                    ? current.columns
                                                                    : {};
                                                                return {
                                                                    ...current,
                                                                    columns: {
                                                                        ...existingColumns,
                                                                        [breakpoint]: Number.parseInt(event.target.value, 10) || 0
                                                                    }
                                                                };
                                                            }) })] }, breakpoint));
                                            }) })] })) : null, hasFeatures ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600", children: [featureCount, " features configured. Detailed editing coming soon\u2014use the Advanced JSON editor below for now."] })) : null, hasTestimonials ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600", children: [testimonialCount, " testimonials configured. Use the Advanced JSON editor to manage quotes and ratings."] })) : null, (0, jsx_runtime_1.jsxs)("details", { className: "overflow-hidden rounded-xl border border-slate-200 bg-slate-50", children: [(0, jsx_runtime_1.jsx)("summary", { className: "cursor-pointer px-4 py-3 text-sm font-medium text-slate-600", children: "Advanced JSON editor" }), (0, jsx_runtime_1.jsx)("textarea", { value: advancedDraft, onChange: (event) => {
                                                const value = event.target.value;
                                                setAdvancedDraft(value);
                                                try {
                                                    const parsed = JSON.parse(value);
                                                    setDraft(parsed);
                                                    setHasLocalChanges(true);
                                                    setJsonError(null);
                                                }
                                                catch {
                                                    setJsonError("Invalid JSON syntax. Fix the errors before applying.");
                                                }
                                            }, className: "h-64 w-full border-t border-slate-200 bg-white px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500", spellCheck: false }), jsonError ? (0, jsx_runtime_1.jsx)("p", { className: "px-4 pb-4 text-xs text-red-500", children: jsonError }) : null] })] }) }), (0, jsx_runtime_1.jsxs)("footer", { className: "flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4", children: [hasLocalChanges && ((0, jsx_runtime_1.jsx)("div", { className: "mr-auto text-xs text-amber-600", children: "Unsaved changes" })), (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: closeModal, className: "rounded-lg px-4 py-2", children: "Cancel" }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", className: "rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600", onClick: handleApply, disabled: !hasLocalChanges, children: "Save" })] })] })] }));
};
exports.BlockSettingsModal = BlockSettingsModal;
//# sourceMappingURL=BlockSettingsModal.js.map