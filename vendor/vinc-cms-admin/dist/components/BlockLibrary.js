"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockLibrary = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const registry_js_1 = require("../registry.js");
const pageBuilderStore_js_1 = require("../store/pageBuilderStore.js");
const COLOR_MAP = {
    "hero-full-width": { bg: "bg-orange-100", text: "text-orange-600", icon: lucide_react_1.LayoutDashboard },
    "hero-split": { bg: "bg-purple-100", text: "text-purple-600", icon: lucide_react_1.Layout },
    "hero-carousel": { bg: "bg-pink-100", text: "text-pink-600", icon: lucide_react_1.Layers },
    "hero-with-widgets": { bg: "bg-indigo-100", text: "text-indigo-600", icon: lucide_react_1.LayoutDashboard },
    "product-slider": { bg: "bg-blue-100", text: "text-blue-600", icon: lucide_react_1.Rows },
    "product-grid": { bg: "bg-cyan-100", text: "text-cyan-600", icon: lucide_react_1.SquareStack },
    "category-grid": { bg: "bg-emerald-100", text: "text-emerald-600", icon: lucide_react_1.SquareKanban },
    "carousel-hero": { bg: "bg-sky-100", text: "text-sky-600", icon: lucide_react_1.Images },
    "carousel-promo": { bg: "bg-rose-100", text: "text-rose-600", icon: lucide_react_1.Sparkles },
    "carousel-brand": { bg: "bg-indigo-100", text: "text-indigo-600", icon: lucide_react_1.Layout },
    "carousel-flyer": { bg: "bg-amber-100", text: "text-amber-600", icon: lucide_react_1.Rows },
    "carousel-products": { bg: "bg-lime-100", text: "text-lime-600", icon: lucide_react_1.SquareStack },
    "carousel-gallery": { bg: "bg-fuchsia-100", text: "text-fuchsia-600", icon: lucide_react_1.Images },
    "content-rich-text": { bg: "bg-slate-100", text: "text-slate-600", icon: lucide_react_1.Type },
    "content-features": { bg: "bg-yellow-100", text: "text-yellow-600", icon: lucide_react_1.Sparkles },
    "content-testimonials": { bg: "bg-indigo-100", text: "text-indigo-600", icon: lucide_react_1.Quote },
    "content-custom-html": { bg: "bg-slate-100", text: "text-slate-600", icon: lucide_react_1.Code },
    "youtubeEmbed": { bg: "bg-red-100", text: "text-red-600", icon: lucide_react_1.Youtube },
    "media-image": { bg: "bg-teal-100", text: "text-teal-600", icon: lucide_react_1.Image },
    "product-data-table": { bg: "bg-amber-100", text: "text-amber-600", icon: lucide_react_1.Table },
    "form-contact": { bg: "bg-violet-100", text: "text-violet-600", icon: lucide_react_1.FileText }
};
const buildLibraryEntries = (allowedBlockIds) => {
    const allEntries = Object.values(registry_js_1.BLOCK_REGISTRY).flatMap((family) => Object.values(family.variants)
        .filter((variant) => !variant.hidden)
        .map((variant) => {
        const colors = COLOR_MAP[variant.id] ?? {
            bg: "bg-slate-100",
            text: "text-slate-600",
            icon: lucide_react_1.Layout
        };
        return {
            id: variant.id,
            label: variant.label,
            bg: colors.bg,
            text: colors.text,
            icon: colors.icon
        };
    }));
    // If allowedBlockIds is provided, filter the entries
    if (allowedBlockIds && allowedBlockIds.length > 0) {
        return allEntries.filter((entry) => allowedBlockIds.includes(entry.id));
    }
    return allEntries;
};
const BlockLibrary = ({ allowedBlockIds } = {}) => {
    const addBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.addBlock);
    const entries = (0, react_1.useMemo)(() => buildLibraryEntries(allowedBlockIds), [allowedBlockIds]);
    return ((0, jsx_runtime_1.jsxs)("nav", { className: "flex h-full w-full flex-col overflow-hidden", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-2 py-4", children: (0, jsx_runtime_1.jsx)("div", { className: "text-[0.714rem] font-semibold uppercase tracking-[0.5px] text-[#b9b9c3]", children: "Blocks" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 space-y-0 overflow-y-auto px-2 pb-4", children: entries.map((entry) => {
                    const Icon = entry.icon;
                    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => addBlock(entry.id), className: "group flex w-full flex-col items-center gap-2 border-l-[3px] border-transparent px-2 py-3 text-center transition-all hover:border-l-[#009688] hover:bg-[rgba(0,150,136,0.08)]", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-9 w-9 items-center justify-center rounded-[0.428rem] bg-[#fafafc] text-[#5e5873] transition-all group-hover:bg-[rgba(0,150,136,0.12)] group-hover:text-[#009688]", children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-[1.1rem] w-[1.1rem]" }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-[0.7rem] leading-[1.2] text-[#b9b9c3]", children: entry.label })] }, entry.id));
                }) })] }));
};
exports.BlockLibrary = BlockLibrary;
//# sourceMappingURL=BlockLibrary.js.map