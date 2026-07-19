"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeroWithWidgetsSettings = HeroWithWidgetsSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const label_js_1 = require("../ui/label.js");
const input_js_1 = require("../ui/input.js");
const button_js_1 = require("../ui/button.js");
const lucide_react_1 = require("lucide-react");
const useImageUpload_js_1 = require("../hooks/useImageUpload.js");
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
function HeroWithWidgetsSettings({ blockId, config, onSave }) {
    const [slides, setSlides] = (0, react_1.useState)(config.slides || []);
    const [autoplay, setAutoplay] = (0, react_1.useState)(config.autoplay ?? true);
    const [autoplaySpeed, setAutoplaySpeed] = (0, react_1.useState)(config.autoplaySpeed || 5000);
    const [loop, setLoop] = (0, react_1.useState)(config.loop ?? true);
    const [showDots, setShowDots] = (0, react_1.useState)(config.showDots ?? true);
    const [showArrows, setShowArrows] = (0, react_1.useState)(config.showArrows ?? true);
    const [breakpointMode, setBreakpointMode] = (0, react_1.useState)(config.breakpointMode || "simplified");
    const [itemsToShow, setItemsToShow] = (0, react_1.useState)({
        desktop: config.itemsToShow?.desktop || 2,
        tablet: config.itemsToShow?.tablet || 2,
        mobile: config.itemsToShow?.mobile || 1
    });
    const [breakpointsJSON, setBreakpointsJSON] = (0, react_1.useState)(JSON.stringify(config.breakpointsJSON || {
        "1536": { slidesPerView: 2, spaceBetween: 20 },
        "1280": { slidesPerView: 2, spaceBetween: 20 },
        "1024": { slidesPerView: 2, spaceBetween: 20 },
        "768": { slidesPerView: 2, spaceBetween: 16 },
        "520": { slidesPerView: 1, spaceBetween: 12 },
        "0": { slidesPerView: 1, spaceBetween: 8 }
    }, null, 2));
    // Widget settings
    const [clockEnabled, setClockEnabled] = (0, react_1.useState)(config.widgets?.clock?.enabled ?? true);
    const [clockTimezone, setClockTimezone] = (0, react_1.useState)(config.widgets?.clock?.timezone || "Europe/Rome");
    const [showWeather, setShowWeather] = (0, react_1.useState)(config.widgets?.clock?.showWeather ?? true);
    const [weatherLocation, setWeatherLocation] = (0, react_1.useState)(config.widgets?.clock?.weatherLocation || "Paris");
    const [calendarEnabled, setCalendarEnabled] = (0, react_1.useState)(config.widgets?.calendar?.enabled ?? true);
    const [highlightToday, setHighlightToday] = (0, react_1.useState)(config.widgets?.calendar?.highlightToday ?? true);
    const addSlide = () => {
        const newSlide = {
            id: `slide-${Date.now()}`,
            imageDesktop: { url: "", alt: "" },
            imageMobile: { url: "", alt: "" },
            link: { url: "", openInNewTab: false },
            title: "",
            description: ""
        };
        setSlides([...slides, newSlide]);
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
        else {
            newSlides[index] = { ...newSlides[index], [field]: value };
        }
        setSlides(newSlides);
    };
    // Track if this is the initial mount to avoid triggering onSave on first render
    const isInitialMount = (0, react_1.useRef)(true);
    // Use a ref to store the latest onSave callback to avoid infinite loops
    const onSaveRef = (0, react_1.useRef)(onSave);
    (0, react_1.useEffect)(() => {
        onSaveRef.current = onSave;
    }, [onSave]);
    // Auto-sync settings to parent whenever they change
    (0, react_1.useEffect)(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            const finalConfig = {
                slides,
                autoplay,
                autoplaySpeed,
                loop,
                showDots,
                showArrows,
                breakpointMode,
                widgets: {
                    clock: {
                        enabled: clockEnabled,
                        timezone: clockTimezone,
                        showWeather,
                        weatherLocation
                    },
                    calendar: {
                        enabled: calendarEnabled,
                        highlightToday
                    }
                },
                layout: {
                    carouselWidth: "80%",
                    widgetsWidth: "20%"
                },
                className: config.className || "hero-with-widgets-section"
            };
            if (breakpointMode === "simplified") {
                finalConfig.itemsToShow = itemsToShow;
            }
            else {
                // Only parse if valid JSON
                try {
                    finalConfig.breakpointsJSON = JSON.parse(breakpointsJSON);
                }
                catch {
                    // Keep existing breakpointsJSON if parse fails
                    finalConfig.breakpointsJSON = config.breakpointsJSON;
                }
            }
            onSaveRef.current(finalConfig);
        }
        catch (error) {
            console.error("Error syncing config:", error);
        }
    }, [
        slides, autoplay, autoplaySpeed, loop, showDots, showArrows, breakpointMode,
        clockEnabled, clockTimezone, showWeather, weatherLocation,
        calendarEnabled, highlightToday, itemsToShow, breakpointsJSON,
        config.className, config.breakpointsJSON
    ]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Hero with Widgets Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("h4", { className: "font-medium", children: "Carousel Slides (80% Left)" }) }), slides.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center", children: (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "No slides yet. Click \"Add Slide\" to get started." }) })), slides.map((slide, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-gray-200 bg-white p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("h5", { className: "font-medium", children: ["Slide ", index + 1] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { onClick: () => moveSlide(index, "up"), disabled: index === 0, size: "sm", variant: "ghost", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveUp, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { onClick: () => moveSlide(index, "down"), disabled: index === slides.length - 1, size: "sm", variant: "ghost", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoveDown, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { onClick: () => removeSlide(index), size: "sm", variant: "ghost", className: "text-red-500 hover:bg-red-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)(ImageUploadField, { label: "Desktop Image URL (Recommended: 1920x600px)", value: slide.imageDesktop.url, onChange: (url) => updateSlide(index, "imageDesktop", { ...slide.imageDesktop, url }), placeholder: "https://example.com/hero-desktop.jpg" }), (0, jsx_runtime_1.jsx)(ImageUploadField, { label: "Mobile Image URL (Recommended: 768x800px)", value: slide.imageMobile.url, onChange: (url) => updateSlide(index, "imageMobile", { ...slide.imageMobile, url }), placeholder: "https://example.com/hero-mobile.jpg" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Alt Text" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: slide.imageDesktop.alt, onChange: (e) => {
                                                    updateSlide(index, "imageDesktop", { ...slide.imageDesktop, alt: e.target.value });
                                                    updateSlide(index, "imageMobile", { ...slide.imageMobile, alt: e.target.value });
                                                }, placeholder: "Describe the image", className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Link URL (optional)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "url", value: slide.link?.url || "", onChange: (e) => updateSlide(index, "link", {
                                                    url: e.target.value,
                                                    openInNewTab: slide.link?.openInNewTab || false
                                                }), placeholder: "https://example.com/products", className: "mt-1" })] })] })] }, slide.id))), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: addSlide, size: "sm", variant: "outline", className: "mt-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-2 h-4 w-4" }), "Add Slide"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-white p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Responsive Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-6 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "simplified", onChange: () => setBreakpointMode("simplified") }), "Simplified"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === "advanced", onChange: () => setBreakpointMode("advanced") }), "Advanced (JSON)"] })] }), breakpointMode === "simplified" ? ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Desktop (\u22651024px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, value: itemsToShow.desktop, onChange: (event) => setItemsToShow((prev) => ({ ...prev, desktop: Number(event.target.value) })), className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Tablet (\u2265768px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, value: itemsToShow.tablet, onChange: (event) => setItemsToShow((prev) => ({ ...prev, tablet: Number(event.target.value) })), className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Mobile (<768px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, value: itemsToShow.mobile, onChange: (event) => setItemsToShow((prev) => ({ ...prev, mobile: Number(event.target.value) })), className: "mt-2" })] })] })) : ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Breakpoints JSON" }), (0, jsx_runtime_1.jsx)("textarea", { value: breakpointsJSON, onChange: (event) => setBreakpointsJSON(event.target.value), rows: 8, className: "mt-2 w-full rounded-lg border border-slate-300 p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-slate-500", children: ["Provide Swiper.js breakpoint configuration. Example: ", `{"1024": {"slidesPerView": 2}}`] })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium", children: "Widget Settings (20% Right)" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-gray-200 bg-white p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "font-medium", children: "Clock Widget (Top)" }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: clockEnabled, onChange: (e) => setClockEnabled(e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white" })] })] }), clockEnabled && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Timezone" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: clockTimezone, onChange: (e) => setClockTimezone(e.target.value), placeholder: "Europe/Rome", className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Show Weather" }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showWeather, onChange: (e) => setShowWeather(e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white" })] })] }), showWeather && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Weather Location" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "text", value: weatherLocation, onChange: (e) => setWeatherLocation(e.target.value), placeholder: "Paris", className: "mt-1" })] }))] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-gray-200 bg-white p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "font-medium", children: "Calendar Widget (Bottom)" }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: calendarEnabled, onChange: (e) => setCalendarEnabled(e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white" })] })] }), calendarEnabled && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs", children: "Highlight Today" }), (0, jsx_runtime_1.jsxs)("label", { className: "relative inline-flex cursor-pointer items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: highlightToday, onChange: (e) => setHighlightToday(e.target.checked), className: "peer sr-only" }), (0, jsx_runtime_1.jsx)("div", { className: "peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white" })] })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Carousel options" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: autoplay, onChange: (e) => setAutoplay(e.target.checked) }), "Autoplay"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: loop, onChange: (e) => setLoop(e.target.checked) }), "Loop slides"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showDots, onChange: (e) => setShowDots(e.target.checked) }), "Show dots"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showArrows, onChange: (e) => setShowArrows(e.target.checked) }), "Show arrows"] })] }), autoplay && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Autoplay speed (ms)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", value: autoplaySpeed, onChange: (e) => setAutoplaySpeed(Number(e.target.value)), min: 1000, max: 10000, step: 500, className: "mt-2" })] }))] })] }));
}
//# sourceMappingURL=HeroWithWidgetsSettings.js.map