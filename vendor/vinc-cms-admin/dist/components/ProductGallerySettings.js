"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductGallerySettings = ProductGallerySettings;
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
function ProductGallerySettings({ config, onSave }) {
    // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
    const onSaveRef = (0, react_1.useRef)(onSave);
    (0, react_1.useEffect)(() => {
        onSaveRef.current = onSave;
    }, [onSave]);
    const [title, setTitle] = (0, react_1.useState)(config.title || "Product Gallery");
    const [searchQuery, setSearchQuery] = (0, react_1.useState)(config.searchQuery || "");
    const [limit, setLimit] = (0, react_1.useState)(config.limit || 12);
    const [columns, setColumns] = (0, react_1.useState)({
        desktop: config.columns?.desktop || 4,
        tablet: config.columns?.tablet || 2,
        mobile: config.columns?.mobile || 1
    });
    const [gap, setGap] = (0, react_1.useState)(config.gap ?? 16);
    const [showPrice, setShowPrice] = (0, react_1.useState)(config.showPrice ?? true);
    const [showBadge, setShowBadge] = (0, react_1.useState)(config.showBadge ?? true);
    const [showAddToCart, setShowAddToCart] = (0, react_1.useState)(config.showAddToCart ?? false);
    const [cachedProducts, setCachedProducts] = (0, react_1.useState)([]);
    // Track if this is the initial mount to avoid triggering onSave on first render
    const isInitialMount = (0, react_1.useRef)(true);
    // Auto-sync settings to parent whenever they change
    (0, react_1.useEffect)(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const payload = {
            title: title.trim() || 'Product Gallery',
            searchQuery: searchQuery.trim(),
            limit: clamp(limit, 1, 50),
            columns: {
                desktop: clamp(Number(columns.desktop), 1, 6),
                tablet: clamp(Number(columns.tablet), 1, 4),
                mobile: clamp(Number(columns.mobile), 1, 3)
            },
            gap: clamp(Number(gap), 0, 64),
            showPrice,
            showBadge,
            showAddToCart,
            className: config.className || 'mb-12 xl:mb-14 pt-1'
        };
        onSaveRef.current(payload);
    }, [title, searchQuery, limit, columns.desktop, columns.tablet, columns.mobile, gap, showPrice, showBadge, showAddToCart, config.className]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-base font-semibold", children: "Section title" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: title, onChange: (event) => setTitle(event.target.value), placeholder: "Product Gallery", className: "mt-2" })] }), (0, jsx_runtime_1.jsx)(ProductSearchPreview_js_1.ProductSearchPreview, { searchQuery: searchQuery, limit: limit, cachedProducts: cachedProducts, onSearchChange: setSearchQuery, onLimitChange: setLimit, onProductsLoaded: setCachedProducts }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Desktop columns" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 6, value: columns.desktop, onChange: (event) => setColumns({ ...columns, desktop: Number(event.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Tablet columns" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 4, value: columns.tablet, onChange: (event) => setColumns({ ...columns, tablet: Number(event.target.value) }), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Mobile columns" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 3, value: columns.mobile, onChange: (event) => setColumns({ ...columns, mobile: Number(event.target.value) }), className: "mt-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs uppercase tracking-wide text-slate-500", children: "Grid gap (px)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 0, max: 64, value: gap, onChange: (event) => setGap(Number(event.target.value)), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-semibold text-slate-700", children: "Display options" }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showPrice, onChange: (event) => setShowPrice(event.target.checked) }), "Show price"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showBadge, onChange: (event) => setShowBadge(event.target.checked) }), "Show badge"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: showAddToCart, onChange: (event) => setShowAddToCart(event.target.checked) }), "Show add to cart button"] })] })] }));
}
//# sourceMappingURL=ProductGallerySettings.js.map