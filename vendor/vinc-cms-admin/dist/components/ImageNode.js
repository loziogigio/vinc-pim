"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomImage = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
const react_2 = require("react");
const lucide_react_1 = require("lucide-react");
// React component for the image node view
function ImageNodeView({ node, updateAttributes, deleteNode, selected }) {
    const [showControls, setShowControls] = (0, react_2.useState)(false);
    const imageRef = (0, react_2.useRef)(null);
    (0, react_2.useEffect)(() => {
        setShowControls(selected);
    }, [selected]);
    const setSize = (size) => {
        const sizes = {
            small: "300px",
            medium: "500px",
            large: "700px",
            original: "100%"
        };
        updateAttributes({ width: sizes[size] });
    };
    const setAlignment = (align) => {
        updateAttributes({ align });
    };
    const alignmentMap = {
        left: "mr-auto",
        center: "mx-auto",
        right: "ml-auto"
    };
    const alignmentClass = alignmentMap[node.attrs.align || "center"];
    return ((0, jsx_runtime_1.jsx)(react_1.NodeViewWrapper, { className: "relative my-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: `relative inline-block ${alignmentClass}`, children: [(0, jsx_runtime_1.jsx)("img", { ref: imageRef, src: node.attrs.src, alt: node.attrs.alt || "", title: node.attrs.title || "", className: "rounded-lg transition-all hover:ring-4 hover:ring-blue-400 hover:ring-offset-2", style: {
                                width: node.attrs.width || "auto",
                                maxWidth: "100%",
                                height: "auto",
                                cursor: "pointer"
                            }, onClick: () => setShowControls(!showControls) }), showControls && ((0, jsx_runtime_1.jsxs)("div", { className: "absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-slate-300 rounded-lg shadow-lg p-1 flex items-center gap-1 z-10", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setSize("small"), className: "px-3 py-1 text-xs font-medium rounded hover:bg-slate-100 transition", title: "Small (300px)", children: "Small" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setSize("medium"), className: "px-3 py-1 text-xs font-medium rounded hover:bg-slate-100 transition", title: "Medium (500px)", children: "Medium" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setSize("large"), className: "px-3 py-1 text-xs font-medium rounded hover:bg-slate-100 transition", title: "Large (700px)", children: "Large" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setSize("original"), className: "px-3 py-1 text-xs font-medium rounded hover:bg-slate-100 transition", title: "Original size", children: "Original" }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setAlignment("left"), className: `p-1.5 rounded hover:bg-slate-100 transition ${node.attrs.align === "left" ? "bg-slate-200" : ""}`, title: "Align left", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlignLeft, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setAlignment("center"), className: `p-1.5 rounded hover:bg-slate-100 transition ${node.attrs.align === "center" || !node.attrs.align ? "bg-slate-200" : ""}`, title: "Align center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlignCenter, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setAlignment("right"), className: `p-1.5 rounded hover:bg-slate-100 transition ${node.attrs.align === "right" ? "bg-slate-200" : ""}`, title: "Align right", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlignRight, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)("button", { onClick: deleteNode, className: "p-1.5 rounded hover:bg-red-100 text-red-600 transition", title: "Delete image", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }))] }), showControls && ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-500 text-center", children: ["Current width: ", node.attrs.width || "auto"] }))] }) }));
}
// Custom Tiptap Image extension
exports.CustomImage = core_1.Node.create({
    name: "customImage",
    group: "block",
    atom: true,
    addAttributes() {
        return {
            src: {
                default: null
            },
            alt: {
                default: null
            },
            title: {
                default: null
            },
            width: {
                default: "500px"
            },
            align: {
                default: "center"
            }
        };
    },
    parseHTML() {
        return [
            {
                tag: "img[src]"
            }
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return ["img", (0, core_1.mergeAttributes)(HTMLAttributes)];
    },
    addNodeView() {
        return (0, react_1.ReactNodeViewRenderer)(ImageNodeView);
    },
    addCommands() {
        return {
            setCustomImage: (options) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: options
                });
            }
        };
    }
});
//# sourceMappingURL=ImageNode.js.map