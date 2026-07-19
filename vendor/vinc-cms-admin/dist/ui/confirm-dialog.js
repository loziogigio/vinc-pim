"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmDialog = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("./button.js");
const utils_js_1 = require("./utils.js");
const ConfirmDialog = ({ open, title, message, confirmText = "Confirm", cancelText = "Cancel", variant = "warning", onConfirm, onCancel }) => {
    if (!open)
        return null;
    const variantStyles = {
        danger: {
            icon: lucide_react_1.AlertTriangle,
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            buttonBg: "bg-red-600 hover:bg-red-700"
        },
        warning: {
            icon: lucide_react_1.AlertTriangle,
            iconBg: "bg-amber-100",
            iconColor: "text-amber-600",
            buttonBg: "bg-amber-600 hover:bg-amber-700"
        },
        info: {
            icon: lucide_react_1.Info,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            buttonBg: "bg-blue-600 hover:bg-blue-700"
        },
        success: {
            icon: lucide_react_1.CheckCircle,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
            buttonBg: "bg-emerald-600 hover:bg-emerald-700"
        }
    };
    const style = variantStyles[variant];
    const Icon = style.icon;
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "relative w-full max-w-md rounded-2xl bg-white shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-4 border-b border-slate-200 p-6", children: [(0, jsx_runtime_1.jsx)("div", { className: (0, utils_js_1.cn)("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full", style.iconBg), children: (0, jsx_runtime_1.jsx)(Icon, { className: (0, utils_js_1.cn)("h-6 w-6", style.iconColor) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-900", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm text-slate-600", children: message })] }), (0, jsx_runtime_1.jsx)("button", { onClick: onCancel, className: "rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-5 w-5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 p-6", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: onCancel, className: "flex-1 rounded-xl", children: cancelText }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { onClick: onConfirm, className: (0, utils_js_1.cn)("flex-1 rounded-xl text-white", style.buttonBg), children: confirmText })] })] }) }));
};
exports.ConfirmDialog = ConfirmDialog;
//# sourceMappingURL=confirm-dialog.js.map