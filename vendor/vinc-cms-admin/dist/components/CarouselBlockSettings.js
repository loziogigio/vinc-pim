"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarouselBlockSettings = CarouselBlockSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const label_js_1 = require("../ui/label.js");
const input_js_1 = require("../ui/input.js");
const button_js_1 = require("../ui/button.js");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
function CarouselBlockSettings({ blockId, config, onSave }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
    const onSaveRef = (0, react_1.useRef)(onSave);
    (0, react_1.useEffect)(() => {
        onSaveRef.current = onSave;
    }, [onSave]);
    const [apiEndpoint, setApiEndpoint] = (0, react_1.useState)(config.apiEndpoint || "");
    const [autoplay, setAutoplay] = (0, react_1.useState)(config.autoplay ?? false);
    const [loop, setLoop] = (0, react_1.useState)(config.loop ?? false);
    const [className, setClassName] = (0, react_1.useState)(config.className || "mb-12 xl:mb-14 pt-1");
    const [breakpoints, setBreakpoints] = (0, react_1.useState)(JSON.stringify(config.breakpoints || {}, null, 2));
    const [isPreviewLoading, setIsPreviewLoading] = (0, react_1.useState)(false);
    const [previewData, setPreviewData] = (0, react_1.useState)(null);
    const handlePreview = async () => {
        if (!apiEndpoint)
            return;
        setIsPreviewLoading(true);
        try {
            const response = await fetch(apiEndpoint);
            if (response.ok) {
                const data = await response.json();
                setPreviewData(data);
            }
            else {
                setPreviewData({ error: "Failed to load preview" });
            }
        }
        catch (error) {
            setPreviewData({ error: "Invalid API endpoint" });
        }
        finally {
            setIsPreviewLoading(false);
        }
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
            let parsedBreakpoints;
            try {
                parsedBreakpoints = JSON.parse(breakpoints);
            }
            catch {
                parsedBreakpoints = config.breakpoints || {};
            }
            onSaveRef.current({
                apiEndpoint,
                autoplay,
                loop,
                className,
                breakpoints: parsedBreakpoints
            });
        }
        catch (error) {
            console.error("Error syncing config:", error);
        }
    }, [apiEndpoint, autoplay, loop, className, breakpoints, config.breakpoints]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "apiEndpoint", children: t("components.builder.carouselBlock.apiEndpoint") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "apiEndpoint", type: "text", value: apiEndpoint, onChange: (e) => setApiEndpoint(e.target.value), placeholder: "/api/cms/slider-top", className: "mt-1" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-gray-500", children: t("components.builder.carouselBlock.apiEndpointHint") })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", onClick: handlePreview, disabled: !apiEndpoint || isPreviewLoading, variant: "outline", size: "sm", children: [isPreviewLoading ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, t("components.builder.carouselBlock.previewData")] }) }), previewData && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-md border bg-gray-50 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "mb-2 text-sm font-medium", children: t("components.builder.carouselBlock.previewResult") }), (0, jsx_runtime_1.jsx)("pre", { className: "max-h-40 overflow-auto text-xs", children: JSON.stringify(previewData, null, 2) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { id: "autoplay", type: "checkbox", checked: autoplay, onChange: (e) => setAutoplay(e.target.checked), className: "h-4 w-4 rounded border-gray-300" }), (0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "autoplay", className: "cursor-pointer", children: t("components.builder.carouselBlock.autoplay") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { id: "loop", type: "checkbox", checked: loop, onChange: (e) => setLoop(e.target.checked), className: "h-4 w-4 rounded border-gray-300" }), (0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "loop", className: "cursor-pointer", children: t("components.builder.carouselBlock.loop") })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "className", children: t("components.builder.carouselBlock.cssClasses") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { id: "className", type: "text", value: className, onChange: (e) => setClassName(e.target.value), placeholder: "mb-12 xl:mb-14 pt-1", className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { htmlFor: "breakpoints", children: t("components.builder.carouselBlock.breakpointsJson") }), (0, jsx_runtime_1.jsx)("textarea", { id: "breakpoints", value: breakpoints, onChange: (e) => setBreakpoints(e.target.value), rows: 10, className: "mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm", placeholder: `{
  "1536": { "slidesPerView": 2, "spaceBetween": 20 },
  "1280": { "slidesPerView": 2, "spaceBetween": 16 },
  "0": { "slidesPerView": 1, "spaceBetween": 5 }
}` }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-gray-500", children: t("components.builder.carouselBlock.breakpointsHint") })] })] }));
}
//# sourceMappingURL=CarouselBlockSettings.js.map