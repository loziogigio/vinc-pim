"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCarouselSettings = MediaCarouselSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const label_js_1 = require("../ui/label.js");
const input_js_1 = require("../ui/input.js");
const button_js_1 = require("../ui/button.js");
const lucide_react_1 = require("lucide-react");
const useImageUpload_js_1 = require("../hooks/useImageUpload.js");
const adapter_js_1 = require("../adapter.js");
// Image Upload Field Component
function ImageUploadField({ label, value, onChange, placeholder, className = "" }) {
    const fileInputRef = (0, react_1.useRef)(null);
    const { uploadState, uploadImage, resetError } = (0, useImageUpload_js_1.useImageUpload)();
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        resetError();
        const cdnUrl = await uploadImage(file);
        if (cdnUrl) {
            onChange(cdnUrl);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: className, children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: label }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => fileInputRef.current?.click(), disabled: uploadState.isUploading, className: "flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50", children: uploadState.isUploading ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "h-3 w-3 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" }), uploadState.progress, "%"] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-3 w-3" }), "Upload"] })) }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, className: "flex-1" }), (0, jsx_runtime_1.jsx)("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileUpload, className: "hidden" })] }), uploadState.error && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-red-600", children: uploadState.error }))] })] }));
}
function MediaCarouselSettings({ blockId, config, onSave }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
    const onSaveRef = (0, react_1.useRef)(onSave);
    (0, react_1.useEffect)(() => {
        onSaveRef.current = onSave;
    }, [onSave]);
    const defaultCardStyle = {
        borderWidth: 0,
        borderColor: "#EAEEF2",
        borderStyle: "solid",
        borderRadius: "md",
        shadowSize: "none",
        shadowColor: "rgba(0, 0, 0, 0.15)",
        backgroundColor: "#ffffff",
        hoverEffect: "none",
        hoverScale: 1.02,
        hoverShadowSize: "lg",
        hoverBackgroundColor: ""
    };
    const [items, setItems] = (0, react_1.useState)(config.items || []);
    const [variant, setVariant] = (0, react_1.useState)(config.variant || "promo");
    const [breakpointMode, setBreakpointMode] = (0, react_1.useState)(config.breakpointMode || "simplified");
    const [itemsToShow, setItemsToShow] = (0, react_1.useState)({
        desktop: config.itemsToShow?.desktop || 5.5,
        tablet: config.itemsToShow?.tablet || 4.5,
        mobile: config.itemsToShow?.mobile || 2.5
    });
    const [breakpointsJSON, setBreakpointsJSON] = (0, react_1.useState)(JSON.stringify(config.breakpointsJSON || {
        "1536": { slidesPerView: 5.5, spaceBetween: 20 },
        "768": { slidesPerView: 4.5, spaceBetween: 16 },
        "520": { slidesPerView: 3.5, spaceBetween: 12 },
        "0": { slidesPerView: 2.5, spaceBetween: 5 }
    }, null, 2));
    const [autoplay, setAutoplay] = (0, react_1.useState)(config.autoplay ?? false);
    const [loop, setLoop] = (0, react_1.useState)(config.loop ?? false);
    const [cardStyle, setCardStyle] = (0, react_1.useState)({
        ...defaultCardStyle,
        ...(config.cardStyle || {})
    });
    const [showStyling, setShowStyling] = (0, react_1.useState)(false);
    const addItem = () => {
        const newItem = {
            id: `item-${Date.now()}`,
            mediaType: "image",
            imageDesktop: { url: "", alt: "" },
            imageMobile: { url: "", alt: "" },
            link: { url: "", openInNewTab: false },
            title: ""
        };
        setItems([...items, newItem]);
    };
    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };
    const moveItem = (index, direction) => {
        if ((direction === "up" && index === 0) ||
            (direction === "down" && index === items.length - 1)) {
            return;
        }
        const newItems = [...items];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setItems(newItems);
    };
    const updateItem = (index, field, value) => {
        const newItems = [...items];
        if (field === "link" || field === "imageDesktop" || field === "imageMobile") {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        setItems(newItems);
    };
    const updateCardStyleField = (field, value) => {
        setCardStyle((prev) => {
            const next = {
                ...prev,
                [field]: value
            };
            if (field === "borderStyle" && value === "none") {
                next.borderWidth = 0;
            }
            if (field === "hoverEffect") {
                if (value === "shadow" || value === "glow") {
                    next.hoverShadowSize = next.hoverShadowSize || "lg";
                }
                else {
                    next.hoverShadowSize = undefined;
                }
            }
            return next;
        });
    };
    // Track if this is the initial mount to avoid triggering onSave on first render
    const isInitialMount = (0, react_1.useRef)(true);
    // Auto-sync settings to parent whenever they change
    (0, react_1.useEffect)(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            const baseConfig = {
                items,
                variant,
                breakpointMode,
                autoplay,
                loop,
                cardStyle,
                className: config.className || "mb-12 xl:mb-14 pt-1"
            };
            let finalConfig;
            if (breakpointMode === "simplified") {
                finalConfig = { ...baseConfig, itemsToShow };
            }
            else {
                try {
                    finalConfig = { ...baseConfig, breakpointsJSON: JSON.parse(breakpointsJSON) };
                }
                catch {
                    finalConfig = { ...baseConfig, breakpointsJSON: config.breakpointsJSON };
                }
            }
            onSaveRef.current(finalConfig);
        }
        catch (error) {
            console.error("Error syncing config:", error);
        }
    }, [items, variant, breakpointMode, autoplay, loop, cardStyle, config.className, config.breakpointsJSON, itemsToShow, breakpointsJSON]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: t("components.builder.mediaCarousel.carouselType") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: variant === "promo", onChange: () => setVariant("promo"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.variantPromoBanner") })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: variant === "brand", onChange: () => setVariant("brand"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.variantBrandLogos") })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: variant === "flyer", onChange: () => setVariant("flyer"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.variantFlyersCatalogs") })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-3", children: (0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: t("components.builder.mediaCarousel.mediaItems") }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: items.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: t("components.builder.mediaCarousel.noItemsYet") })) : (items.map((item, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-gray-200 bg-gray-50 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium", children: t("components.builder.mediaCarousel.itemNumber", { number: String(index + 1) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-1", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => moveItem(index, "up"), disabled: index === 0, children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveUp, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => moveItem(index, "down"), disabled: index === items.length - 1, children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveDown, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => removeItem(index), className: "text-red-600 hover:text-red-700", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.mediaType") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: item.mediaType === "image", onChange: () => updateItem(index, "mediaType", "image"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.mediaTypeImage") })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: item.mediaType === "video", onChange: () => updateItem(index, "mediaType", "video"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.mediaTypeVideo") })] })] })] }), item.mediaType === "image" ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(ImageUploadField, { label: t("components.builder.mediaCarousel.desktopImageUrl"), value: item.imageDesktop?.url || "", onChange: (url) => updateItem(index, "imageDesktop", {
                                                        url,
                                                        alt: item.imageDesktop?.alt || ""
                                                    }), placeholder: "https://example.com/image-desktop.jpg" }), (0, jsx_runtime_1.jsx)(ImageUploadField, { label: t("components.builder.mediaCarousel.mobileImageUrl"), value: item.imageMobile?.url || "", onChange: (url) => updateItem(index, "imageMobile", {
                                                        url,
                                                        alt: item.imageMobile?.alt || ""
                                                    }), placeholder: "https://example.com/image-mobile.jpg" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.altText") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: item.imageDesktop?.alt || "", onChange: (e) => {
                                                                updateItem(index, "imageDesktop", {
                                                                    url: item.imageDesktop?.url || "",
                                                                    alt: e.target.value
                                                                });
                                                                updateItem(index, "imageMobile", {
                                                                    url: item.imageMobile?.url || "",
                                                                    alt: e.target.value
                                                                });
                                                            }, placeholder: t("components.builder.mediaCarousel.altTextPlaceholder"), className: "mt-1" })] })] })) : (
                                        /* Video URL */
                                        (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.videoUrl") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: item.videoUrl || "", onChange: (e) => updateItem(index, "videoUrl", e.target.value), placeholder: "https://www.youtube.com/embed/...", className: "mt-1" })] })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.linkUrl") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: item.link?.url || "", onChange: (e) => updateItem(index, "link", {
                                                        url: e.target.value,
                                                        openInNewTab: item.link?.openInNewTab || false
                                                    }), placeholder: "https://example.com/product", className: "mt-1" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: `openInNewTab-${index}`, checked: item.link?.openInNewTab || false, onChange: (e) => updateItem(index, "link", {
                                                                url: item.link?.url || "",
                                                                openInNewTab: e.target.checked
                                                            }), className: "h-4 w-4 rounded border-gray-300" }), (0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: `openInNewTab-${index}`, className: "cursor-pointer text-xs", children: t("components.builder.mediaCarousel.openInNewTab") })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.itemTitle") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: item.title || "", onChange: (e) => updateItem(index, "title", e.target.value), placeholder: t("components.builder.mediaCarousel.itemTitlePlaceholder"), className: "mt-1" })] })] })] }, item.id)))) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", onClick: addItem, size: "sm", variant: "outline", className: "mt-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-4 w-4" }), " ", t("components.builder.mediaCarousel.addItem")] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: t("components.builder.mediaCarousel.responsiveSettings") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "simplified", onChange: () => setBreakpointMode("simplified"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.breakpointSimplified") })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "advanced", onChange: () => setBreakpointMode("advanced"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: t("components.builder.mediaCarousel.breakpointAdvanced") })] })] })] }), breakpointMode === "simplified" && ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.breakpointDesktop") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.desktop, onChange: (e) => setItemsToShow({ ...itemsToShow, desktop: parseFloat(e.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.breakpointTablet") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.tablet, onChange: (e) => setItemsToShow({ ...itemsToShow, tablet: parseFloat(e.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.breakpointMobile") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.mobile, onChange: (e) => setItemsToShow({ ...itemsToShow, mobile: parseFloat(e.target.value) }), className: "mt-1" })] })] })), breakpointMode === "advanced" && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: t("components.builder.mediaCarousel.breakpointsJson") }), (0, jsx_runtime_1.jsx)("textarea", { value: breakpointsJSON, onChange: (e) => setBreakpointsJSON(e.target.value), rows: 6, className: "mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm", placeholder: `{
  "1536": { "slidesPerView": 5.5, "spaceBetween": 20 },
  "0": { "slidesPerView": 2.5, "spaceBetween": 5 }
}` })] })), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 bg-white", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setShowStyling((prev) => !prev), className: "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700", children: [(0, jsx_runtime_1.jsx)("span", { children: t("components.builder.mediaCarousel.cardStyling") }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: showStyling ? t("components.builder.mediaCarousel.hide") : t("components.builder.mediaCarousel.show") })] }), showStyling ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 border-t border-slate-200 px-4 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: [t("components.builder.mediaCarousel.borderWidth"), ": ", cardStyle.borderWidth, "px"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 0, max: 8, value: cardStyle.borderWidth, onChange: (event) => updateCardStyleField("borderWidth", Number(event.target.value)), className: "w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.borderColor") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.borderColor, onChange: (event) => updateCardStyleField("borderColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.borderColor, onChange: (event) => updateCardStyleField("borderColor", event.target.value), className: "flex-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.backgroundColor") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.backgroundColor, onChange: (event) => updateCardStyleField("backgroundColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.backgroundColor, onChange: (event) => updateCardStyleField("backgroundColor", event.target.value), className: "flex-1" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.borderStyle") }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.borderStyle, onChange: (event) => updateCardStyleField("borderStyle", event.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "solid", children: t("components.builder.mediaCarousel.borderStyleSolid") }), (0, jsx_runtime_1.jsx)("option", { value: "dashed", children: t("components.builder.mediaCarousel.borderStyleDashed") }), (0, jsx_runtime_1.jsx)("option", { value: "dotted", children: t("components.builder.mediaCarousel.borderStyleDotted") }), (0, jsx_runtime_1.jsx)("option", { value: "none", children: t("common.none") })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.cornerRoundness") }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.borderRadius, onChange: (event) => updateCardStyleField("borderRadius", event.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: t("components.builder.mediaCarousel.radiusSquare") }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: t("components.builder.mediaCarousel.radiusSlightly") }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: t("components.builder.mediaCarousel.radiusModerately") }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: t("components.builder.mediaCarousel.radiusVery") }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: t("components.builder.mediaCarousel.radiusExtra") }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: t("components.builder.mediaCarousel.radiusSuper") }), (0, jsx_runtime_1.jsx)("option", { value: "full", children: t("components.builder.mediaCarousel.radiusFull") })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.shadowSize") }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.shadowSize, onChange: (event) => updateCardStyleField("shadowSize", event.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: t("components.builder.mediaCarousel.shadowNone") }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: t("components.builder.mediaCarousel.shadowSmall") }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: t("components.builder.mediaCarousel.shadowMedium") }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: t("components.builder.mediaCarousel.shadowLarge") }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: t("components.builder.mediaCarousel.shadowExtraLarge") }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: t("components.builder.mediaCarousel.shadowHuge") })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.shadowColor") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.shadowColor, onChange: (event) => updateCardStyleField("shadowColor", event.target.value), className: "mt-1 h-9" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.hoverEffect") }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.hoverEffect, onChange: (event) => updateCardStyleField("hoverEffect", event.target.value), className: "h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: t("common.none") }), (0, jsx_runtime_1.jsx)("option", { value: "lift", children: t("components.builder.mediaCarousel.hoverLift") }), (0, jsx_runtime_1.jsx)("option", { value: "shadow", children: t("components.builder.mediaCarousel.hoverShadow") }), (0, jsx_runtime_1.jsx)("option", { value: "scale", children: t("components.builder.mediaCarousel.hoverScale") }), (0, jsx_runtime_1.jsx)("option", { value: "border", children: t("components.builder.mediaCarousel.hoverBorder") }), (0, jsx_runtime_1.jsx)("option", { value: "glow", children: t("components.builder.mediaCarousel.hoverGlow") })] })] }), cardStyle.hoverEffect === "scale" ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: [t("components.builder.mediaCarousel.hoverScaleLabel"), ": ", (cardStyle.hoverScale ?? 1.02).toFixed(2), "\u00D7"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 1, max: 1.1, step: 0.01, value: cardStyle.hoverScale ?? 1.02, onChange: (event) => updateCardStyleField("hoverScale", Number(event.target.value)), className: "w-full" })] })) : null, ["shadow", "glow"].includes(cardStyle.hoverEffect) ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.hoverShadowSize") }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.hoverShadowSize ?? "lg", onChange: (event) => updateCardStyleField("hoverShadowSize", event.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "sm", children: t("components.builder.mediaCarousel.shadowSmall") }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: t("components.builder.mediaCarousel.shadowMedium") }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: t("components.builder.mediaCarousel.shadowLarge") }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: t("components.builder.mediaCarousel.shadowExtraLarge") }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: t("components.builder.mediaCarousel.shadowHuge") })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: t("components.builder.mediaCarousel.hoverBackground") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.hoverBackgroundColor || "#ffffff", onChange: (event) => updateCardStyleField("hoverBackgroundColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.hoverBackgroundColor || "", placeholder: t("components.builder.mediaCarousel.optionalHexColor"), onChange: (event) => updateCardStyleField("hoverBackgroundColor", event.target.value), className: "flex-1" })] })] })] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: t("components.builder.mediaCarousel.carouselOptions") }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: autoplay, onChange: (e) => setAutoplay(e.target.checked) }), t("components.builder.mediaCarousel.autoplay")] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: loop, onChange: (e) => setLoop(e.target.checked) }), t("components.builder.mediaCarousel.loopSlides")] })] })] })] }));
}
//# sourceMappingURL=MediaCarouselSettings.js.map