"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullScreenModal = FullScreenModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_dom_1 = require("react-dom");
const lucide_react_1 = require("lucide-react");
function FullScreenModal({ open, onClose, title, children, actions, maxWidth = "max-w-3xl", }) {
    // Lock body scroll when open
    (0, react_1.useEffect)(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);
    // Close on Escape
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const handleKey = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);
    if (!open)
        return null;
    return (0, react_dom_1.createPortal)((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-[60] flex", children: [(0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm", onClick: onClose }), (0, jsx_runtime_1.jsxs)("div", { className: "relative z-10 flex flex-col w-full bg-card animate-in slide-in-from-right duration-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-b border-border px-6 py-4 shrink-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClose, className: "flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors", "aria-label": "Close", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: title })] }), actions && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3", children: actions }))] }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 overflow-y-auto px-6 py-6", children: (0, jsx_runtime_1.jsx)("div", { className: `mx-auto ${maxWidth}`, children: children }) })] })] }), document.body);
}
//# sourceMappingURL=full-screen-modal.js.map