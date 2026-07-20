"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductCarouselSettings = ProductCarouselSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const label_js_1 = require("../ui/label.js");
const input_js_1 = require("../ui/input.js");
const ProductSearchPreview_js_1 = require("./ProductSearchPreview.js");
const clamp = (value, min, max) => {
    if (Number.isNaN(value))
        return min;
    return Math.min(Math.max(value, min), max);
};
function ProductCarouselSettings({ config, onSave }) {
    const [title, setTitle] = (0, react_1.useState)(config.title || "");
    const [searchQuery, setSearchQuery] = (0, react_1.useState)(config.searchQuery || "");
    const [limit, setLimit] = (0, react_1.useState)(config.limit || 12);
    const [dataSource, setDataSource] = (0, react_1.useState)(config.dataSource || "search");
    const [breakpointMode, setBreakpointMode] = (0, react_1.useState)(config.breakpointMode || "simplified");
    const [itemsToShow, setItemsToShow] = (0, react_1.useState)({
        desktop: config.itemsToShow?.desktop || 4,
        tablet: config.itemsToShow?.tablet || 3,
        mobile: config.itemsToShow?.mobile || 1
    });
    const [breakpointsJSON, setBreakpointsJSON] = (0, react_1.useState)(JSON.stringify(config.breakpointsJSON || {
        "1536": { slidesPerView: 4, spaceBetween: 16 },
        "1280": { slidesPerView: 4, spaceBetween: 16 },
        "1024": { slidesPerView: 3, spaceBetween: 16 },
        "768": { slidesPerView: 2, spaceBetween: 12 },
        "520": { slidesPerView: 1, spaceBetween: 8 },
        "0": { slidesPerView: 1, spaceBetween: 6 }
    }, null, 2));
    const [autoplay, setAutoplay] = (0, react_1.useState)(config.autoplay ?? false);
    const [autoplaySpeed, setAutoplaySpeed] = (0, react_1.useState)(config.autoplaySpeed || 5000);
    const [loop, setLoop] = (0, react_1.useState)(config.loop ?? false);
    const [showDots, setShowDots] = (0, react_1.useState)(config.showDots ?? true);
    const [showArrows, setShowArrows] = (0, react_1.useState)(config.showArrows ?? true);
    const [cachedProducts, setCachedProducts] = (0, react_1.useState)([]);
    const [isInitialized, setIsInitialized] = (0, react_1.useState)(false);
    // Mark as initialized after first render
    (0, react_1.useEffect)(() => {
        setIsInitialized(true);
    }, []);
    // Auto-save whenever any setting changes (skip initial mount)
    (0, react_1.useEffect)(() => {
        if (!isInitialized)
            return;
        const payload = {
            title: title.trim(),
            searchQuery: searchQuery.trim(),
            limit: clamp(limit, 1, 50),
            dataSource,
            breakpointMode,
            autoplay,
            autoplaySpeed: clamp(autoplaySpeed, 1000, 20000),
            loop,
            showDots,
            showArrows,
            className: config.className || 'mb-12 xl:mb-14 pt-1'
        };
        if (breakpointMode === 'simplified') {
            payload.itemsToShow = {
                desktop: clamp(Number(itemsToShow.desktop), 1, 6),
                tablet: clamp(Number(itemsToShow.tablet), 1, 6),
                mobile: clamp(Number(itemsToShow.mobile), 1, 4)
            };
        }
        else {
            try {
                payload.breakpointsJSON = JSON.parse(breakpointsJSON || '{}');
            }
            catch {
                payload.breakpointsJSON = config.breakpointsJSON || {};
            }
        }
        onSave(payload);
    }, [isInitialized, title, searchQuery, limit, dataSource, breakpointMode, autoplay, autoplaySpeed, loop, showDots, showArrows, itemsToShow, breakpointsJSON]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Section title" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: title, onChange: (event) => setTitle(event.target.value), placeholder: "Featured Products", className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Data source" }), (0, jsx_runtime_1.jsxs)("select", { value: dataSource, onChange: (event) => setDataSource(event.target.value), className: "mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-700", children: [(0, jsx_runtime_1.jsx)("option", { value: "search", children: "Keyword / advanced query" }), (0, jsx_runtime_1.jsx)("option", { value: "trending", children: "Trending products" }), (0, jsx_runtime_1.jsx)("option", { value: "liked", children: "Customer liked products" }), (0, jsx_runtime_1.jsx)("option", { value: "reminder", children: "Customer reminded products" })] }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-500", children: "Use \"Trending\", \"Liked\", or \"Reminder\" for special carousels that load automatically. Keywords are ignored for those sources." })] }), dataSource === 'search' ? ((0, jsx_runtime_1.jsx)(ProductSearchPreview_js_1.ProductSearchPreview, { searchQuery: searchQuery, limit: limit, cachedProducts: cachedProducts, onSearchChange: setSearchQuery, onLimitChange: setLimit, onProductsLoaded: setCachedProducts })) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500", children: "Products are loaded automatically by the storefront." })), dataSource !== 'search' ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Maximum products" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 50, value: limit, onChange: (event) => setLimit(Number(event.target.value)), className: "mt-2" })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Carousel options" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: autoplay, onChange: (event) => setAutoplay(event.target.checked) }), "Autoplay"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: loop, onChange: (event) => setLoop(event.target.checked) }), "Loop slides"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showDots, onChange: (event) => setShowDots(event.target.checked) }), "Show dots"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showArrows, onChange: (event) => setShowArrows(event.target.checked) }), "Show arrows"] })] }), autoplay && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Autoplay speed (ms)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1000, max: 20000, step: 500, value: autoplaySpeed, onChange: (event) => setAutoplaySpeed(Number(event.target.value)), className: "mt-2" })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 rounded-lg border border-slate-200 bg-white p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Responsive breakpoints" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-6 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === 'simplified', onChange: () => setBreakpointMode('simplified') }), "Simplified"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", checked: breakpointMode === 'advanced', onChange: () => setBreakpointMode('advanced') }), "Advanced (JSON)"] })] }), breakpointMode === 'simplified' ? ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Desktop" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 6, value: itemsToShow.desktop, onChange: (event) => setItemsToShow({ ...itemsToShow, desktop: Number(event.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Tablet" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 4, value: itemsToShow.tablet, onChange: (event) => setItemsToShow({ ...itemsToShow, tablet: Number(event.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Mobile" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 3, value: itemsToShow.mobile, onChange: (event) => setItemsToShow({ ...itemsToShow, mobile: Number(event.target.value) }), className: "mt-1" })] })] })) : ((0, jsx_runtime_1.jsx)("textarea", { value: breakpointsJSON, onChange: (event) => setBreakpointsJSON(event.target.value), rows: 8, className: "mt-2 w-full rounded-md border border-slate-300 p-2 font-mono text-sm" }))] })] }));
}
//# sourceMappingURL=ProductCarouselSettings.js.map