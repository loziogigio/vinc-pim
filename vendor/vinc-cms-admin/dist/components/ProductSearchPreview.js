"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSearchPreview = ProductSearchPreview;
const jsx_runtime_1 = require("react/jsx-runtime");
/* eslint-disable @next/next/no-img-element */
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const input_js_1 = require("../ui/input.js");
const label_js_1 = require("../ui/label.js");
const adapter_js_1 = require("../adapter.js");
const search_query_js_1 = require("../search-query.js");
// ============================================================================
// Component
// ============================================================================
function ProductSearchPreview({ searchQuery, limit, cachedProducts, onSearchChange, onLimitChange, onProductsLoaded, }) {
    const { searchProducts } = (0, adapter_js_1.useCmsAdmin)();
    const [isSearching, setIsSearching] = (0, react_1.useState)(false);
    const [searchError, setSearchError] = (0, react_1.useState)(null);
    const [localQuery, setLocalQuery] = (0, react_1.useState)(searchQuery);
    const onProductsLoadedRef = (0, react_1.useRef)(onProductsLoaded);
    (0, react_1.useEffect)(() => {
        onProductsLoadedRef.current = onProductsLoaded;
    }, [onProductsLoaded]);
    // Parse advanced query for summary display
    const parsedSearchSummary = (0, react_1.useMemo)(() => (0, search_query_js_1.parseAdvancedQuery)(localQuery), [localQuery]);
    // Debounced parent notification of query change
    (0, react_1.useEffect)(() => {
        const timer = setTimeout(() => {
            if (localQuery !== searchQuery) {
                onSearchChange(localQuery);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localQuery, searchQuery, onSearchChange]);
    // Auto-search when query or limit changes. The actual product lookup is delegated to the
    // host via useCmsAdmin().searchProducts, which owns tenant scoping and advanced-query parsing.
    (0, react_1.useEffect)(() => {
        if (!localQuery.trim()) {
            onProductsLoadedRef.current([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setIsSearching(true);
            setSearchError(null);
            try {
                const products = await searchProducts(localQuery, { limit });
                if (!cancelled)
                    onProductsLoadedRef.current(products);
            }
            catch (err) {
                if (!cancelled) {
                    setSearchError("Failed to search products");
                    console.error("Product search error:", err);
                }
            }
            finally {
                if (!cancelled)
                    setIsSearching(false);
            }
        }, 800);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [localQuery, limit, searchProducts]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-lg border border-border bg-muted p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "h-4 w-4 text-muted-foreground" }), (0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "font-medium", children: "Product Search" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs text-muted-foreground", children: "Search Query" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(input_js_1.Input, { value: localQuery, onChange: (e) => setLocalQuery(e.target.value), placeholder: "e.g. caldaia, climatizzatore, rubinetto", className: "pr-10" }), isSearching && ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" }))] }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-muted-foreground", children: ["Paste a keyword or an advanced query (e.g.", " ", (0, jsx_runtime_1.jsx)("code", { className: "rounded bg-muted px-1 py-0.5 text-[10px]", children: "shop?text=moon&filters-brand_id=004" }), ")."] }), parsedSearchSummary ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground", children: [parsedSearchSummary.keyword ? ((0, jsx_runtime_1.jsxs)("div", { className: "mb-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-foreground", children: "Keyword:" }), " ", (0, jsx_runtime_1.jsx)("span", { children: parsedSearchSummary.keyword })] })) : null, parsedSearchSummary.filters.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: parsedSearchSummary.filters.map(({ key, values }) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1 rounded bg-card px-2 py-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-[11px] font-semibold uppercase text-muted-foreground", children: key }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] text-foreground", children: values.join(", ") })] }, key))) })) : null] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs text-muted-foreground", children: "Max Products" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 1, max: 50, value: limit, onChange: (e) => onLimitChange(parseInt(e.target.value) || 10) })] }), searchError ? (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-red-500", children: searchError }) : null, cachedProducts && cachedProducts.length > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)(label_js_1.Label, { className: "text-xs text-muted-foreground", children: ["Found ", cachedProducts.length, " products"] }), (0, jsx_runtime_1.jsx)("div", { className: "grid max-h-48 grid-cols-3 gap-2 overflow-y-auto", children: cachedProducts.map((product) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center rounded border border-border bg-card p-2", children: [product.image ? ((0, jsx_runtime_1.jsx)("img", { src: product.image, alt: product.name, className: "h-12 w-12 object-contain" })) : ((0, jsx_runtime_1.jsx)("div", { className: "flex h-12 w-12 items-center justify-center rounded bg-muted", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Package, { className: "h-6 w-6 text-muted-foreground" }) })), (0, jsx_runtime_1.jsx)("span", { className: "mt-1 w-full truncate text-center text-[10px] text-muted-foreground", children: product.sku })] }, product.id))) })] })) : null, localQuery.trim() && !isSearching && cachedProducts?.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "py-2 text-center text-xs text-muted-foreground", children: "No products found" })) : null] })] }));
}
//# sourceMappingURL=ProductSearchPreview.js.map