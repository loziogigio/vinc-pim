"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeroCarouselSettings = HeroCarouselSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const label_js_1 = require("../ui/label.js");
const input_js_1 = require("../ui/input.js");
const button_js_1 = require("../ui/button.js");
const lucide_react_1 = require("lucide-react");
const useImageUpload_js_1 = require("../hooks/useImageUpload.js");
const SECTION_CLASS_FALLBACK = "mb-12 xl:mb-14 pt-1";
const DEFAULT_OVERLAY = {
    position: "bottom",
    textColor: "#ffffff",
    backgroundColor: "#0f172a",
    backgroundOpacity: 0.65
};
const withOverlayDefaults = (overlay) => ({
    ...DEFAULT_OVERLAY,
    ...(overlay || {})
});
const normalizeSlide = (slide) => ({
    ...slide,
    overlay: withOverlayDefaults(slide.overlay)
});
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
function HeroCarouselSettings({ blockId, config, onSave }) {
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
    const [slides, setSlides] = (0, react_1.useState)(() => (config.slides || []).map(normalizeSlide));
    const [breakpointMode, setBreakpointMode] = (0, react_1.useState)(config.breakpointMode || "simplified");
    const [itemsToShow, setItemsToShow] = (0, react_1.useState)({
        desktop: config.itemsToShow?.desktop || 2,
        tablet: config.itemsToShow?.tablet || 2,
        mobile: config.itemsToShow?.mobile || 1
    });
    const [breakpointsJSON, setBreakpointsJSON] = (0, react_1.useState)(JSON.stringify(config.breakpointsJSON || {
        "1536": { slidesPerView: 2, spaceBetween: 20 },
        "1280": { slidesPerView: 2, spaceBetween: 16 },
        "1024": { slidesPerView: 2, spaceBetween: 16 },
        "768": { slidesPerView: 2, spaceBetween: 16 },
        "520": { slidesPerView: 2, spaceBetween: 12 },
        "0": { slidesPerView: 1, spaceBetween: 5 }
    }, null, 2));
    const [autoplay, setAutoplay] = (0, react_1.useState)(config.autoplay ?? true);
    const [autoplaySpeed, setAutoplaySpeed] = (0, react_1.useState)(config.autoplaySpeed || 5000);
    const [loop, setLoop] = (0, react_1.useState)(config.loop ?? true);
    const [showDots, setShowDots] = (0, react_1.useState)(config.showDots ?? true);
    const [showArrows, setShowArrows] = (0, react_1.useState)(config.showArrows ?? true);
    const [cardStyle, setCardStyle] = (0, react_1.useState)({
        ...defaultCardStyle,
        ...(config.cardStyle || {})
    });
    const [isStyleOpen, setIsStyleOpen] = (0, react_1.useState)(false);
    const [sectionTitle, setSectionTitle] = (0, react_1.useState)(config.title || "");
    const [sectionClassName, setSectionClassName] = (0, react_1.useState)(config.className || SECTION_CLASS_FALLBACK);
    const addSlide = () => {
        const newSlide = {
            id: `slide-${Date.now()}`,
            imageDesktop: { url: "", alt: "" },
            imageMobile: { url: "", alt: "" },
            link: { url: "", openInNewTab: false },
            title: "",
            overlay: { ...DEFAULT_OVERLAY }
        };
        setSlides((prev) => [...prev, newSlide]);
    };
    const removeSlide = (index) => {
        setSlides(slides.filter((_, i) => i !== index));
    };
    const moveSlide = (index, direction) => {
        if ((direction === "up" && index === 0) ||
            (direction === "down" && index === slides.length - 1)) {
            return;
        }
        const newSlides = [...slides];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
        setSlides(newSlides);
    };
    const updateSlide = (index, field, value) => {
        const newSlides = [...slides];
        if (field === "link") {
            newSlides[index] = { ...newSlides[index], link: value };
        }
        else if (field === "overlay") {
            newSlides[index] = { ...newSlides[index], overlay: withOverlayDefaults(value) };
        }
        else {
            newSlides[index] = { ...newSlides[index], [field]: value };
        }
        setSlides(newSlides);
    };
    const updateCardStyleField = (field, value) => {
        setCardStyle((prev) => ({
            ...prev,
            [field]: value
        }));
    };
    const updateOverlayField = (index, field, value) => {
        const existing = withOverlayDefaults(slides[index]?.overlay);
        updateSlide(index, "overlay", {
            ...existing,
            [field]: value
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
            const normalizedSlides = slides.map(normalizeSlide);
            const trimmedTitle = sectionTitle.trim();
            const baseConfig = {
                title: trimmedTitle,
                slides: normalizedSlides,
                breakpointMode,
                autoplay,
                autoplaySpeed,
                loop,
                showDots,
                showArrows,
                cardStyle,
                className: sectionClassName?.trim() || SECTION_CLASS_FALLBACK
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
    }, [
        slides, sectionTitle, breakpointMode, autoplay, autoplaySpeed, loop,
        showDots, showArrows, cardStyle, sectionClassName, itemsToShow, breakpointsJSON,
        config.breakpointsJSON
    ]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-lg border border-slate-200 bg-white p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Section title (optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: sectionTitle, onChange: (event) => setSectionTitle(event.target.value), placeholder: "e.g. Campaign spotlight" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "When filled, the storefront shows a section heading above the carousel. Leave blank to hide it." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Container Tailwind classes" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: sectionClassName, onChange: (event) => setSectionClassName(event.target.value), placeholder: SECTION_CLASS_FALLBACK }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-500", children: ["These classes wrap the whole block (background, padding, borders). Example:", " ", (0, jsx_runtime_1.jsx)("code", { className: "rounded bg-slate-100 px-1 py-0.5", children: "bg-amber-50 border border-amber-200 rounded-2xl px-6 py-10" }), " ", "reproduces the yellow highlight shown in the builder."] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-3", children: (0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Hero Slides" }) }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: slides.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "No slides added yet. Click \"Add Slide\" to get started." })) : (slides.map((slide, index) => {
                            const overlay = slide.overlay ?? DEFAULT_OVERLAY;
                            return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-gray-200 bg-gray-50 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-medium", children: ["Slide ", index + 1] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-1", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => moveSlide(index, "up"), disabled: index === 0, children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveUp, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => moveSlide(index, "down"), disabled: index === slides.length - 1, children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveDown, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "ghost", onClick: () => removeSlide(index), className: "text-red-600 hover:text-red-700", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)(ImageUploadField, { label: "Desktop Image URL (Recommended: 1920x600px)", value: slide.imageDesktop.url, onChange: (url) => updateSlide(index, "imageDesktop", { ...slide.imageDesktop, url }), placeholder: "https://example.com/hero-desktop.jpg" }), (0, jsx_runtime_1.jsx)(ImageUploadField, { label: "Mobile Image URL (Recommended: 768x800px)", value: slide.imageMobile.url, onChange: (url) => updateSlide(index, "imageMobile", { ...slide.imageMobile, url }), placeholder: "https://example.com/hero-mobile.jpg" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Alt Text" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: slide.imageDesktop.alt, onChange: (e) => {
                                                            updateSlide(index, "imageDesktop", { ...slide.imageDesktop, alt: e.target.value });
                                                            updateSlide(index, "imageMobile", { ...slide.imageMobile, alt: e.target.value });
                                                        }, placeholder: "Describe the image", className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Link URL (optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: slide.link?.url || "", onChange: (e) => updateSlide(index, "link", {
                                                            url: e.target.value,
                                                            openInNewTab: slide.link?.openInNewTab || false
                                                        }), placeholder: "https://example.com/product", className: "mt-1" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: `openInNewTab-${index}`, checked: slide.link?.openInNewTab || false, onChange: (e) => updateSlide(index, "link", {
                                                                    url: slide.link?.url || "",
                                                                    openInNewTab: e.target.checked
                                                                }), className: "h-4 w-4 rounded border-gray-300" }), (0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: `openInNewTab-${index}`, className: "cursor-pointer text-xs", children: "Open in new tab" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Title (optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: slide.title || "", onChange: (e) => updateSlide(index, "title", e.target.value), placeholder: "Hero title", className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-white bg-white/70 p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Title overlay" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[0.7rem] text-slate-500", children: "Choose whether the title appears at the top, middle, or bottom of the media and control the overlay colors/opacity." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-[11px] font-semibold uppercase text-slate-500", children: "Position" }), (0, jsx_runtime_1.jsxs)("select", { value: overlay.position, onChange: (event) => updateOverlayField(index, "position", event.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "top", children: "Top" }), (0, jsx_runtime_1.jsx)("option", { value: "middle", children: "Center" }), (0, jsx_runtime_1.jsx)("option", { value: "bottom", children: "Bottom" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-[11px] font-semibold uppercase text-slate-500", children: "Text color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: overlay.textColor, onChange: (event) => updateOverlayField(index, "textColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: overlay.textColor, onChange: (event) => updateOverlayField(index, "textColor", event.target.value), className: "flex-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-[11px] font-semibold uppercase text-slate-500", children: "Background color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: overlay.backgroundColor, onChange: (event) => updateOverlayField(index, "backgroundColor", event.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: overlay.backgroundColor, onChange: (event) => updateOverlayField(index, "backgroundColor", event.target.value), className: "flex-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-[11px] font-semibold uppercase text-slate-500", children: ["Background opacity (", Math.round((overlay.backgroundOpacity ?? 0.65) * 100), "%)"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 0, max: 100, value: Math.round((overlay.backgroundOpacity ?? 0.65) * 100), onChange: (event) => updateOverlayField(index, "backgroundOpacity", Number(event.target.value) / 100), className: "mt-3 w-full" })] })] })] })] })] }, slide.id));
                        })) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", onClick: addSlide, size: "sm", variant: "outline", className: "mt-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-4 w-4" }), " Add Slide"] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Responsive Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex gap-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "simplified", onChange: () => setBreakpointMode("simplified"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Simplified" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "advanced", onChange: () => setBreakpointMode("advanced"), className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Advanced (JSON)" })] })] })] }), breakpointMode === "simplified" && ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Desktop (\u22651024px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.desktop, onChange: (event) => {
                                    const inputValue = event.target.value;
                                    setItemsToShow((prev) => {
                                        const parsed = Number.parseFloat(inputValue);
                                        return { ...prev, desktop: Number.isNaN(parsed) ? prev.desktop : parsed };
                                    });
                                }, className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Tablet (\u2265768px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.tablet, onChange: (event) => {
                                    const inputValue = event.target.value;
                                    setItemsToShow((prev) => {
                                        const parsed = Number.parseFloat(inputValue);
                                        return { ...prev, tablet: Number.isNaN(parsed) ? prev.tablet : parsed };
                                    });
                                }, className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Mobile (<768px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", step: "0.5", value: itemsToShow.mobile, onChange: (event) => {
                                    const inputValue = event.target.value;
                                    setItemsToShow((prev) => {
                                        const parsed = Number.parseFloat(inputValue);
                                        return { ...prev, mobile: Number.isNaN(parsed) ? prev.mobile : parsed };
                                    });
                                }, className: "mt-1" })] })] })), breakpointMode === "advanced" && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Breakpoints JSON (Swiper.js format)" }), (0, jsx_runtime_1.jsx)("textarea", { value: breakpointsJSON, onChange: (e) => setBreakpointsJSON(e.target.value), rows: 8, className: "mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm", placeholder: `{
  "1536": { "slidesPerView": 2, "spaceBetween": 20 },
  "0": { "slidesPerView": 1, "spaceBetween": 5 }
}` })] })), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Carousel options" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: autoplay, onChange: (e) => setAutoplay(e.target.checked) }), "Autoplay"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: loop, onChange: (e) => setLoop(e.target.checked) }), "Loop slides"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showDots, onChange: (e) => setShowDots(e.target.checked) }), "Show dots"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showArrows, onChange: (e) => setShowArrows(e.target.checked) }), "Show arrows"] })] }), autoplay && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Autoplay speed (ms)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", value: autoplaySpeed, onChange: (event) => {
                                    const inputValue = event.target.value;
                                    setAutoplaySpeed((prev) => {
                                        const parsed = Number.parseInt(inputValue, 10);
                                        return Number.isNaN(parsed) ? prev : parsed;
                                    });
                                }, className: "mt-2" })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 bg-white", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setIsStyleOpen((prev) => !prev), className: "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700", children: [(0, jsx_runtime_1.jsx)("span", { children: "Slide styling" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: isStyleOpen ? "Hide" : "Show" })] }), isStyleOpen ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 border-t border-slate-200 px-4 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: ["Border width: ", cardStyle.borderWidth, "px"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 0, max: 8, value: cardStyle.borderWidth, onChange: (e) => updateCardStyleField("borderWidth", Number(e.target.value)), className: "w-full" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Border color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.borderColor, onChange: (e) => updateCardStyleField("borderColor", e.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.borderColor, onChange: (e) => updateCardStyleField("borderColor", e.target.value), className: "flex-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Background color" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.backgroundColor, onChange: (e) => updateCardStyleField("backgroundColor", e.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.backgroundColor, onChange: (e) => updateCardStyleField("backgroundColor", e.target.value), className: "flex-1" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Border style" }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.borderStyle, onChange: (e) => updateCardStyleField("borderStyle", e.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "solid", children: "Solid" }), (0, jsx_runtime_1.jsx)("option", { value: "dashed", children: "Dashed" }), (0, jsx_runtime_1.jsx)("option", { value: "dotted", children: "Dotted" }), (0, jsx_runtime_1.jsx)("option", { value: "none", children: "None" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Corner roundness" }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.borderRadius, onChange: (e) => updateCardStyleField("borderRadius", e.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "Square" }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Slightly rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Moderately rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Very rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Super rounded" }), (0, jsx_runtime_1.jsx)("option", { value: "full", children: "Fully rounded" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Shadow size" }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.shadowSize, onChange: (e) => updateCardStyleField("shadowSize", e.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "No shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Small shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Medium shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Large shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra large" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Huge shadow" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Shadow color" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.shadowColor, onChange: (e) => updateCardStyleField("shadowColor", e.target.value), className: "mt-1 h-9" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Hover effect" }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.hoverEffect, onChange: (e) => updateCardStyleField("hoverEffect", e.target.value), className: "h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "None" }), (0, jsx_runtime_1.jsx)("option", { value: "lift", children: "Lift up" }), (0, jsx_runtime_1.jsx)("option", { value: "shadow", children: "Add shadow" }), (0, jsx_runtime_1.jsx)("option", { value: "scale", children: "Grow slightly" }), (0, jsx_runtime_1.jsx)("option", { value: "border", children: "Highlight border" }), (0, jsx_runtime_1.jsx)("option", { value: "glow", children: "Glow effect" })] })] }), cardStyle.hoverEffect === "scale" ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: ["Hover scale: ", (cardStyle.hoverScale ?? 1.02).toFixed(2), "\u00D7"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 1, max: 1.1, step: 0.01, value: cardStyle.hoverScale ?? 1.02, onChange: (e) => updateCardStyleField("hoverScale", Number(e.target.value)), className: "w-full" })] })) : null, ["shadow", "glow"].includes(cardStyle.hoverEffect) ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Hover shadow size" }), (0, jsx_runtime_1.jsxs)("select", { value: cardStyle.hoverShadowSize ?? "lg", onChange: (e) => updateCardStyleField("hoverShadowSize", e.target.value), className: "mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "sm", children: "Small" }), (0, jsx_runtime_1.jsx)("option", { value: "md", children: "Medium" }), (0, jsx_runtime_1.jsx)("option", { value: "lg", children: "Large" }), (0, jsx_runtime_1.jsx)("option", { value: "xl", children: "Extra large" }), (0, jsx_runtime_1.jsx)("option", { value: "2xl", children: "Huge" })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-700", children: "Hover background" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: cardStyle.hoverBackgroundColor || "#ffffff", onChange: (e) => updateCardStyleField("hoverBackgroundColor", e.target.value), className: "h-10 w-12 cursor-pointer rounded border border-slate-200" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: cardStyle.hoverBackgroundColor || "", placeholder: "Optional hex color", onChange: (e) => updateCardStyleField("hoverBackgroundColor", e.target.value), className: "flex-1" })] })] })] })) : null] })] }));
}
//# sourceMappingURL=HeroCarouselSettings.js.map