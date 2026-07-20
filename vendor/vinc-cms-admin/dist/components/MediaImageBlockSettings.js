"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaImageBlockSettings = MediaImageBlockSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const input_js_1 = require("../ui/input.js");
const label_js_1 = require("../ui/label.js");
const lucide_react_1 = require("lucide-react");
const useImageUpload_js_1 = require("../hooks/useImageUpload.js");
const utils_js_1 = require("../ui/utils.js");
function MediaImageBlockSettings({ config, onChange }) {
    const defaultStyle = {
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
    const initialConfig = {
        ...config,
        title: config.title || "",
        className: config.className || "mb-12 xl:mb-14 pt-1",
        style: {
            ...defaultStyle,
            ...(config.style || {})
        }
    };
    const [localConfig, setLocalConfig] = (0, react_1.useState)(initialConfig);
    const [showStyling, setShowStyling] = (0, react_1.useState)(false);
    const fileInputRef = (0, react_1.useRef)(null);
    const { uploadState, uploadImage, resetError } = (0, useImageUpload_js_1.useImageUpload)();
    (0, react_1.useEffect)(() => {
        // Debounce changes
        const timeout = setTimeout(() => {
            onChange(localConfig);
        }, 300);
        return () => clearTimeout(timeout);
    }, [localConfig, onChange]);
    (0, react_1.useEffect)(() => {
        setLocalConfig({
            ...config,
            title: config.title || "",
            className: config.className || "mb-12 xl:mb-14 pt-1",
            style: {
                ...defaultStyle,
                ...(config.style || {})
            }
        });
    }, [config]);
    const updateField = (field, value) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };
    const updateStyleField = (field, value) => {
        setLocalConfig(prev => {
            const nextStyle = {
                ...defaultStyle,
                ...(prev.style || {}),
                [field]: value
            };
            if (field === "borderStyle" && value === "none") {
                nextStyle.borderWidth = 0;
            }
            if (field === "hoverEffect") {
                if (value === "shadow" || value === "glow") {
                    nextStyle.hoverShadowSize = nextStyle.hoverShadowSize || "lg";
                }
                else {
                    nextStyle.hoverShadowSize = undefined;
                }
            }
            return {
                ...prev,
                style: nextStyle
            };
        });
    };
    const styleOptions = (0, react_1.useMemo)(() => ({
        ...defaultStyle,
        ...(localConfig.style || {})
    }), [localConfig.style, defaultStyle]);
    const borderRadiusMap = {
        none: "0",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px"
    };
    const shadowMap = {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
        "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)"
    };
    const hoverShadowMap = {
        sm: shadowMap.sm,
        md: shadowMap.md,
        lg: shadowMap.lg,
        xl: shadowMap.xl,
        "2xl": shadowMap["2xl"]
    };
    const previewCardStyle = (0, react_1.useMemo)(() => {
        const effectiveBorderWidth = styleOptions.borderStyle === "none" || styleOptions.borderWidth <= 0 ? 0 : styleOptions.borderWidth;
        return {
            borderWidth: `${effectiveBorderWidth}px`,
            borderStyle: styleOptions.borderStyle,
            borderColor: styleOptions.borderStyle === "none" ? "transparent" : styleOptions.borderColor,
            borderRadius: borderRadiusMap[styleOptions.borderRadius],
            backgroundColor: styleOptions.backgroundColor,
            boxShadow: styleOptions.shadowSize !== "none"
                ? shadowMap[styleOptions.shadowSize]
                : "none",
            transition: "all 0.2s ease",
            overflow: "hidden"
        };
    }, [styleOptions, borderRadiusMap, shadowMap]);
    const previewHoverData = (0, react_1.useMemo)(() => {
        const declarations = [];
        switch (styleOptions.hoverEffect) {
            case "lift":
                declarations.push("transform: translateY(-4px);");
                break;
            case "shadow":
                declarations.push(`box-shadow: ${hoverShadowMap[styleOptions.hoverShadowSize || "lg"]};`);
                break;
            case "scale":
                declarations.push(`transform: scale(${styleOptions.hoverScale || 1.02});`);
                break;
            case "border":
                declarations.push(`border-color: ${styleOptions.borderColor};`);
                declarations.push("filter: brightness(0.95);");
                break;
            case "glow":
                declarations.push(`box-shadow: 0 0 25px ${styleOptions.shadowColor};`);
                break;
            default:
                break;
        }
        if (styleOptions.hoverBackgroundColor && styleOptions.hoverEffect !== "shadow") {
            declarations.push(`background-color: ${styleOptions.hoverBackgroundColor};`);
        }
        const css = declarations.length
            ? `.media-image-settings-preview:hover { ${declarations.join(" ")} }`
            : "";
        return css;
    }, [styleOptions, hoverShadowMap]);
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // Reset any previous errors
        resetError();
        // Upload to CDN
        const cdnUrl = await uploadImage(file);
        if (cdnUrl) {
            // Update config with CDN URL
            updateField("imageUrl", cdnUrl);
        }
        // Clear file input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-[#5e5873]", children: "Image *" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => fileInputRef.current?.click(), disabled: uploadState.isUploading, className: "flex items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-2 text-[0.857rem] text-[#5e5873] transition hover:bg-[#fafafc] disabled:opacity-50", children: uploadState.isUploading ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "h-4 w-4 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" }), "Uploading... ", uploadState.progress, "%"] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), "Upload to CDN"] })) }), (0, jsx_runtime_1.jsx)("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileUpload, className: "hidden" })] }), uploadState.error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-200 bg-red-50 p-3 text-[0.857rem] text-red-800", children: uploadState.error })), (0, jsx_runtime_1.jsx)("div", { className: "text-[0.75rem] text-[#b9b9c3] text-center py-1", children: "or" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "url", placeholder: "Paste image URL", value: localConfig.imageUrl || "", onChange: (e) => updateField("imageUrl", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Upload an image or paste a CDN URL" })] }), localConfig.imageUrl && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-[#5e5873]", children: "Preview" }), previewHoverData ? ((0, jsx_runtime_1.jsx)("style", { dangerouslySetInnerHTML: { __html: previewHoverData } })) : null, (0, jsx_runtime_1.jsx)("div", { className: (0, utils_js_1.cn)("relative overflow-hidden bg-slate-100 transition-all duration-200", "media-image-settings-preview"), style: previewCardStyle, children: (0, jsx_runtime_1.jsx)("img", { src: localConfig.imageUrl, alt: localConfig.alt || "Preview", className: "w-full h-auto max-h-80 object-contain", style: { borderRadius: borderRadiusMap[styleOptions.borderRadius] }, onError: (e) => {
                                e.currentTarget.src = "";
                                e.currentTarget.alt = "Failed to load image";
                            } }) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-[#5e5873]", children: "Section title (optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", placeholder: "e.g. Media spotlight", value: localConfig.title || "", onChange: (e) => updateField("title", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Display an optional heading above the image. Leave empty to hide it." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-[#5e5873]", children: "Container Tailwind classes" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", placeholder: "mb-12 xl:mb-14 pt-1", value: localConfig.className || "", onChange: (e) => updateField("className", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: ["These classes wrap the entire block (background, spacing, borders). Example:", (0, jsx_runtime_1.jsx)("code", { className: "ml-1 rounded bg-[#f4f5fa] px-1 py-0.5 text-[0.7rem] text-[#5e5873]", children: "bg-amber-50 border border-amber-200 rounded-2xl px-6 py-8" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-alt", className: "text-sm font-medium text-[#5e5873]", children: "Alt Text" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "media-alt", type: "text", placeholder: "Describe the image for accessibility", value: localConfig.alt || "", onChange: (e) => updateField("alt", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Important for SEO and accessibility" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-link", className: "text-sm font-medium text-[#5e5873]", children: "Link URL (Optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "media-link", type: "url", placeholder: "https://example.com", value: localConfig.linkUrl || "", onChange: (e) => updateField("linkUrl", e.target.value), className: "h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Make the image clickable (leave empty for no link)" })] }), localConfig.linkUrl && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-lg border border-[#ebe9f1] bg-[#fafafc] p-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-newtab", className: "text-sm font-medium text-[#5e5873]", children: "Open in New Tab" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: "Link opens in a new browser tab" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { id: "media-newtab", type: "checkbox", checked: localConfig.openInNewTab ?? true, onChange: (e) => updateField("openInNewTab", e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#009688]/20" })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-alignment", className: "text-sm font-medium text-[#5e5873]", children: "Alignment" }), (0, jsx_runtime_1.jsxs)("select", { id: "media-alignment", value: localConfig.alignment || "center", onChange: (e) => updateField("alignment", e.target.value), className: "h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "left", children: "Left" }), (0, jsx_runtime_1.jsx)("option", { value: "center", children: "Center" }), (0, jsx_runtime_1.jsx)("option", { value: "right", children: "Right" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-width", className: "text-sm font-medium text-[#5e5873]", children: "Width" }), (0, jsx_runtime_1.jsxs)("select", { id: "media-width", value: localConfig.width || "100%", onChange: (e) => updateField("width", e.target.value), className: "h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "100%", children: "Full Width (100%)" }), (0, jsx_runtime_1.jsx)("option", { value: "75%", children: "Large (75%)" }), (0, jsx_runtime_1.jsx)("option", { value: "50%", children: "Medium (50%)" }), (0, jsx_runtime_1.jsx)("option", { value: "33%", children: "Small (33%)" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "media-maxwidth", className: "text-sm font-medium text-[#5e5873]", children: "Max Width" }), (0, jsx_runtime_1.jsxs)("select", { id: "media-maxwidth", value: localConfig.maxWidth || "800px", onChange: (e) => updateField("maxWidth", e.target.value), className: "h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "400px", children: "400px" }), (0, jsx_runtime_1.jsx)("option", { value: "600px", children: "600px" }), (0, jsx_runtime_1.jsx)("option", { value: "800px", children: "800px" }), (0, jsx_runtime_1.jsx)("option", { value: "1200px", children: "1200px" }), (0, jsx_runtime_1.jsx)("option", { value: "none", children: "No limit" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-[#ebe9f1] bg-white", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setShowStyling((prev) => !prev), className: "flex w-full items-center justify-between px-4 py-3 text-left text-[0.857rem] font-semibold text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("span", { children: "Styling options" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-[#b9b9c3]", children: showStyling ? "Hide" : "Show" })] }), showStyling ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 border-t border-[#ebe9f1] px-4 py-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[0.75rem] text-[#6f6b7b]", children: "These controls affect the image card only. To change the yellow wrapper/background, use the Tailwind container classes above." }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: ["Border width: ", localConfig.style?.borderWidth ?? 0, "px"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 0, max: 8, value: localConfig.style?.borderWidth ?? 0, onChange: (event) => updateStyleField("borderWidth", Number(event.target.value)), className: "w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Border color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: localConfig.style?.borderColor ?? "#EAEEF2", onChange: (event) => updateStyleField("borderColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: localConfig.style?.borderColor ?? "#EAEEF2", onChange: (event) => updateStyleField("borderColor", event.target.value), className: "flex-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Background color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: localConfig.style?.backgroundColor ?? "#ffffff", onChange: (event) => updateStyleField("backgroundColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: localConfig.style?.backgroundColor ?? "#ffffff", onChange: (event) => updateStyleField("backgroundColor", event.target.value), className: "flex-1" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Border style" }), (0, jsx_runtime_1.jsxs)("select", { value: localConfig.style?.borderStyle ?? "solid", onChange: (event) => updateStyleField("borderStyle", event.target.value), className: "mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "solid", children: "Solid" }), (0, jsx_runtime_1.jsx)("option", { value: "dashed", children: "Dashed" }), (0, jsx_runtime_1.jsx)("option", { value: "dotted", children: "Dotted" }), (0, jsx_runtime_1.jsx)("option", { value: "none", children: "None" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Corner roundness" }), (0, jsx_runtime_1.jsxs)("select", { value: localConfig.style?.borderRadius ?? "md", onChange: (event) => updateStyleField("borderRadius", event.target.value), className: "mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "Square" }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Slightly rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Moderately rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Very rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Super rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "full", children: "Fully rounded" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Shadow size" }), (0, jsx_runtime_1.jsxs)("select", { value: localConfig.style?.shadowSize ?? "none", onChange: (event) => updateStyleField("shadowSize", event.target.value), className: "mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "No shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Small shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Medium shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Large shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra large" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Huge shadow" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Shadow color" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: localConfig.style?.shadowColor ?? "rgba(0, 0, 0, 0.15)", onChange: (event) => updateStyleField("shadowColor", event.target.value), className: "mt-1 h-9" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Hover effect" }), (0, jsx_runtime_1.jsxs)("select", { value: localConfig.style?.hoverEffect ?? "none", onChange: (event) => updateStyleField("hoverEffect", event.target.value), className: "h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "None" }), (0, jsx_runtime_1.jsx)("option", { value: "lift", children: "Lift up" }), (0, jsx_runtime_1.jsx)("option", { value: "shadow", children: "Add shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "scale", children: "Grow slightly" }), (0, jsx_runtime_1.jsx)("option", { value: "border", children: "Highlight border" }), (0, jsx_runtime_1.jsx)("option", { value: "glow", children: "Glow effect" })] })] }), localConfig.style?.hoverEffect === "scale" ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: ["Hover scale: ", (localConfig.style?.hoverScale ?? 1.02).toFixed(2), "\u00D7"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 1, max: 1.1, step: 0.01, value: localConfig.style?.hoverScale ?? 1.02, onChange: (event) => updateStyleField("hoverScale", Number(event.target.value)), className: "w-full" })] })) : null, ["shadow", "glow"].includes(localConfig.style?.hoverEffect ?? "none") ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Hover shadow size" }), (0, jsx_runtime_1.jsxs)("select", { value: localConfig.style?.hoverShadowSize ?? "lg", onChange: (event) => updateStyleField("hoverShadowSize", event.target.value), className: "mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]", children: [(0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Small" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Medium" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Large" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra large" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Huge" })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-[#5e5873]", children: "Hover background" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: localConfig.style?.hoverBackgroundColor || "#ffffff", onChange: (event) => updateStyleField("hoverBackgroundColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: localConfig.style?.hoverBackgroundColor || "", placeholder: "Optional hex color", onChange: (event) => updateStyleField("hoverBackgroundColor", event.target.value), className: "flex-1" })] })] })] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-blue-200 bg-blue-50 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "mb-2 text-[0.857rem] font-medium text-blue-900", children: "\uD83D\uDCA1 Tips:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "space-y-1 text-[0.75rem] text-blue-800", children: [(0, jsx_runtime_1.jsx)("li", { children: "\u2022 Recommended: JPG or PNG format" }), (0, jsx_runtime_1.jsx)("li", { children: "\u2022 Max file size: 20MB" }), (0, jsx_runtime_1.jsx)("li", { children: "\u2022 Images are uploaded to CDN for faster delivery" }), (0, jsx_runtime_1.jsx)("li", { children: "\u2022 Add alt text for better SEO" })] })] })] }));
}
//# sourceMappingURL=MediaImageBlockSettings.js.map