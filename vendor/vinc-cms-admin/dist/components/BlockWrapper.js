"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockWrapper = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utilities_1 = require("@dnd-kit/utilities");
const sortable_1 = require("@dnd-kit/sortable");
const lucide_react_1 = require("lucide-react");
const pageBuilderStore_js_1 = require("../store/pageBuilderStore.js");
const registry_js_1 = require("../registry.js");
const utils_js_1 = require("../ui/utils.js");
const builderStyles = {
    "hero-full-width": {
        previewBg: "bg-gradient-to-r from-[#11998e] to-[#38ef7d]",
        previewText: "text-white"
    },
    "hero-split": {
        previewBg: "bg-gradient-to-r from-[#667eea] to-[#764ba2]",
        previewText: "text-white"
    },
    "hero-carousel": {
        previewBg: "bg-gradient-to-r from-[#4facfe] to-[#00f2fe]",
        previewText: "text-white"
    },
    "hero-with-widgets": {
        previewBg: "bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6]",
        previewText: "text-white",
        previewBorder: "border border-[#93c5fd]"
    },
    "carousel-hero": {
        previewBg: "bg-gradient-to-r from-[#38bdf8] to-[#60a5fa]",
        previewText: "text-white"
    },
    "carousel-promo": {
        previewBg: "bg-[#fff1f2]",
        previewText: "text-[#be123c]",
        previewBorder: "border border-[#fecdd3]"
    },
    "carousel-brand": {
        previewBg: "bg-[#eef2ff]",
        previewText: "text-[#4338ca]",
        previewBorder: "border border-[#e0e7ff]"
    },
    "carousel-flyer": {
        previewBg: "bg-[#fffbeb]",
        previewText: "text-[#b45309]",
        previewBorder: "border border-[#fde68a]"
    },
    "carousel-products": {
        previewBg: "bg-[#f0fdf4]",
        previewText: "text-[#166534]",
        previewBorder: "border border-[#bbf7d0]"
    },
    "carousel-gallery": {
        previewBg: "bg-[#f5f3ff]",
        previewText: "text-[#5b21b6]",
        previewBorder: "border border-[#e9d5ff]"
    },
    "product-slider": {
        previewBg: "bg-[#fafafc]",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-[#ebe9f1]"
    },
    "product-grid": {
        previewBg: "bg-[#fafafc]",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-[#ebe9f1]"
    },
    "category-grid": {
        previewBg: "bg-[#fafafc]",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-[#ebe9f1]"
    },
    "category-carousel": {
        previewBg: "bg-[#fafafc]",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-[#ebe9f1]"
    },
    "content-features": {
        previewBg: "bg-white",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-dashed border-[#d8d6de]"
    },
    "content-rich-text": {
        previewBg: "bg-white",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-dashed border-[#d8d6de]"
    },
    "content-custom-html": {
        previewBg: "bg-white",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-dashed border-[#d8d6de]"
    },
    "content-testimonials": {
        previewBg: "bg-white",
        previewText: "text-[#5e5873]",
        previewBorder: "border border-dashed border-[#d8d6de]"
    },
    youtubeEmbed: {
        previewBg: "bg-[#fef2f2]",
        previewText: "text-[#b91c1c]",
        previewBorder: "border border-[#fee2e2]"
    },
    "media-image": {
        previewBg: "bg-[#ecfeff]",
        previewText: "text-[#0f766e]",
        previewBorder: "border border-[#ccfbf1]"
    }
};
const defaultStyle = {
    previewBg: "bg-[#fafafc]",
    previewText: "text-[#5e5873]",
    previewBorder: "border border-[#ebe9f1]"
};
const BlockWrapper = ({ block, index, onOpenSettings }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = (0, sortable_1.useSortable)({
        id: block.id
    });
    const selectBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.selectBlock);
    const removeBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.removeBlock);
    const duplicateBlock = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.duplicateBlock);
    const selectedBlockId = (0, pageBuilderStore_js_1.usePageBuilderStore)((state) => state.selectedBlockId);
    const style = {
        transform: utilities_1.CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1
    };
    const template = (0, registry_js_1.getBlockTemplate)(block.type);
    const styleTokens = builderStyles[block.type] ?? defaultStyle;
    return ((0, jsx_runtime_1.jsxs)("div", { ref: setNodeRef, style: style, className: (0, utils_js_1.cn)("group relative cursor-pointer overflow-visible rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]/40", selectedBlockId === block.id
            ? "border-[2px] border-[#009688] p-[calc(1rem-1px)] shadow-[0_4px_16px_rgba(0,150,136,0.15)]"
            : "hover:-translate-y-0.5 hover:border-[#009688] hover:shadow-[0_4px_12px_rgba(0,150,136,0.1)]"), role: "button", tabIndex: 0, onClick: () => selectBlock(block.id), onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
                selectBlock(block.id);
            }
        }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "absolute left-4 top-[-10px] z-20 rounded-[12px] bg-[#5e5873] px-[10px] py-[3px] text-[11px] font-semibold text-white shadow-sm", children: ["Position ", index + 1] }), (0, jsx_runtime_1.jsxs)("div", { className: "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-[0.428rem] bg-white/95 px-1 py-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", ...attributes, ...listeners, onClick: (event) => event.stopPropagation(), className: "flex h-7 w-7 cursor-grab items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[#f5f5f5]", "aria-label": "Drag to reorder", children: (0, jsx_runtime_1.jsx)(lucide_react_1.GripVertical, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: (event) => {
                            event.stopPropagation();
                            selectBlock(block.id);
                            onOpenSettings();
                        }, className: "flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[rgba(0,150,136,0.1)] hover:text-[#009688]", "aria-label": "Configure block", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: (event) => {
                            event.stopPropagation();
                            duplicateBlock(block.id);
                        }, className: "flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6e6b7b] transition hover:bg-[#f5f5f5]", "aria-label": "Duplicate block", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: (event) => {
                            event.stopPropagation();
                            removeBlock(block.id);
                        }, className: "flex h-7 w-7 items-center justify-center rounded-[4px] text-red-600 transition hover:bg-red-50", "aria-label": "Remove block", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-[0.75rem]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-[0.15rem]", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-[0.95rem] font-semibold text-[#5e5873]", children: template?.label ?? block.type }), (0, jsx_runtime_1.jsxs)("p", { className: "text-[0.75rem] text-[#b9b9c3]", children: ["Block ", index + 1] })] }), (0, jsx_runtime_1.jsxs)("div", { className: (0, utils_js_1.cn)("rounded-[0.428rem] px-3 py-3 text-center text-[0.85rem] font-medium transition-all", styleTokens.previewBg, styleTokens.previewText, styleTokens.previewBorder), children: [template?.label ?? block.type, " Preview"] })] })] }));
};
exports.BlockWrapper = BlockWrapper;
//# sourceMappingURL=BlockWrapper.js.map