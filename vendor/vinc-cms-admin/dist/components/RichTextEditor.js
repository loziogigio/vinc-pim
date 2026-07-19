"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RichTextEditor = RichTextEditor;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@tiptap/react");
const starter_kit_1 = __importDefault(require("@tiptap/starter-kit"));
const extension_placeholder_1 = __importDefault(require("@tiptap/extension-placeholder"));
const extension_link_1 = __importDefault(require("@tiptap/extension-link"));
const extension_text_style_1 = require("@tiptap/extension-text-style");
const extension_color_1 = require("@tiptap/extension-color");
const extension_highlight_1 = __importDefault(require("@tiptap/extension-highlight"));
const react_2 = require("react");
const adapter_js_1 = require("../adapter.js");
const ImageNode_js_1 = require("./ImageNode.js");
const lucide_react_1 = require("lucide-react");
function RichTextEditor({ content, onChange, placeholder = "Start typing..." }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    const fileInputRef = (0, react_2.useRef)(null);
    const [showTextColor, setShowTextColor] = (0, react_2.useState)(false);
    const [showHighlight, setShowHighlight] = (0, react_2.useState)(false);
    const editor = (0, react_1.useEditor)({
        immediatelyRender: false, // Fix SSR hydration mismatch
        extensions: [
            starter_kit_1.default.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            }),
            extension_placeholder_1.default.configure({
                placeholder
            }),
            extension_link_1.default.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-blue-600 underline"
                }
            }),
            extension_text_style_1.TextStyle,
            extension_color_1.Color,
            extension_highlight_1.default.configure({
                multicolor: true
            }),
            ImageNode_js_1.CustomImage
        ],
        content,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3"
            }
        },
        onUpdate: ({ editor }) => {
            onChange(editor.isEmpty ? "" : editor.getHTML());
        }
    });
    // Update editor content when prop changes (but not if it came from the editor itself)
    (0, react_2.useEffect)(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);
    // Close dropdowns when clicking outside
    (0, react_2.useEffect)(() => {
        const handleClickOutside = () => {
            setShowTextColor(false);
            setShowHighlight(false);
        };
        if (showTextColor || showHighlight) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [showTextColor, showHighlight]);
    if (!editor) {
        return null;
    }
    const setLink = () => {
        const url = window.prompt("Enter URL:");
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };
    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        // Check file type
        if (!file.type.startsWith("image/")) {
            alert(t("components.richTextEditor.selectImageFile"));
            return;
        }
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert(t("components.richTextEditor.imageSizeTooLarge"));
            return;
        }
        // Convert to base64
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result;
            if (base64) {
                // Insert image with custom node
                editor.chain().focus().setCustomImage({
                    src: base64,
                    alt: file.name.replace(/\.[^/.]+$/, ""), // filename without extension
                    title: file.name,
                    width: "500px",
                    align: "center"
                }).run();
            }
        };
        reader.readAsDataURL(file);
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };
    const MenuButton = ({ onClick, active, disabled, children, title }) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClick, disabled: disabled, title: title, className: `p-2 rounded hover:bg-slate-100 transition-colors ${active ? "bg-slate-200 text-slate-900" : "text-slate-600"} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`, children: children }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-slate-300 rounded-lg overflow-hidden bg-white", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-slate-50", children: [(0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), title: "Bold", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Bold, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), title: "Italic", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Italic, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsxs)(MenuButton, { onClick: (e) => {
                                    e?.stopPropagation();
                                    setShowTextColor(!showTextColor);
                                    setShowHighlight(false);
                                }, title: t("components.richTextEditor.textColor"), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Palette, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-3 w-3" })] }), showTextColor && ((0, jsx_runtime_1.jsxs)("div", { className: "absolute top-full left-0 mt-1 bg-white border-2 border-slate-400 rounded-lg shadow-2xl p-3 z-50 w-48", onClick: (e) => e?.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold text-slate-700 mb-2", children: t("components.richTextEditor.textColor") }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-5 gap-2", children: ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#ffffff"].map((color) => ((0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                                editor.chain().focus().setColor(color).run();
                                                setShowTextColor(false);
                                            }, className: "w-8 h-8 rounded border-2 border-slate-400 hover:scale-125 hover:border-blue-500 transition shadow-sm", style: { backgroundColor: color }, title: color }, color))) }), (0, jsx_runtime_1.jsx)("input", { type: "color", onChange: (e) => {
                                            editor.chain().focus().setColor(e.target.value).run();
                                        }, className: "w-full mt-2 h-8 rounded border border-slate-300 cursor-pointer", title: "Custom color" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                            editor.chain().focus().setColor("#000000").run();
                                            setShowTextColor(false);
                                        }, className: "w-full mt-2 text-xs px-2 py-1.5 border border-slate-300 rounded hover:bg-slate-100 font-medium", children: t("components.richTextEditor.resetToBlack") })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsxs)(MenuButton, { onClick: (e) => {
                                    e?.stopPropagation();
                                    setShowHighlight(!showHighlight);
                                    setShowTextColor(false);
                                }, title: t("components.richTextEditor.highlightColor"), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Highlighter, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-3 w-3" })] }), showHighlight && ((0, jsx_runtime_1.jsxs)("div", { className: "absolute top-full left-0 mt-1 bg-white border-2 border-slate-400 rounded-lg shadow-2xl p-3 z-50 w-48", onClick: (e) => e?.stopPropagation(), children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs font-semibold text-slate-700 mb-2", children: t("components.richTextEditor.highlightColor") }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-5 gap-2", children: ["#fef3c7", "#fecaca", "#fed7aa", "#d9f99d", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e2e8f0", "#fbbf24", "#ffffff"].map((color) => ((0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                                editor.chain().focus().setHighlight({ color }).run();
                                                setShowHighlight(false);
                                            }, className: "w-8 h-8 rounded border-2 border-slate-400 hover:scale-125 hover:border-blue-500 transition shadow-sm", style: { backgroundColor: color }, title: color }, color))) }), (0, jsx_runtime_1.jsx)("input", { type: "color", onChange: (e) => {
                                            editor.chain().focus().setHighlight({ color: e.target.value }).run();
                                        }, className: "w-full mt-2 h-8 rounded border border-slate-300 cursor-pointer", title: "Custom highlight color" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                            editor.chain().focus().unsetHighlight().run();
                                            setShowHighlight(false);
                                        }, className: "w-full mt-2 text-xs px-2 py-1.5 border border-slate-300 rounded hover:bg-slate-100 font-medium", children: t("components.richTextEditor.removeHighlight") })] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }), title: "Heading", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Heading2, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), title: "Bullet List", children: (0, jsx_runtime_1.jsx)(lucide_react_1.List, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), title: "Numbered List", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ListOrdered, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote"), title: "Quote", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Quote, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock"), title: "Code Block", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Code, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "w-px h-6 bg-slate-300 mx-1" }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: setLink, active: editor.isActive("link"), title: "Add Link", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Link2, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: triggerImageUpload, title: "Upload Image", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ImageIcon, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1" }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), title: "Undo", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Undo, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(MenuButton, { onClick: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), title: "Redo", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Redo, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsx)(react_1.EditorContent, { editor: editor }), (0, jsx_runtime_1.jsx)("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleImageUpload, className: "hidden" })] }));
}
//# sourceMappingURL=RichTextEditor.js.map