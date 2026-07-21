"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helperClass = exports.labelClass = exports.inputClass = void 0;
exports.Field = Field;
exports.ColorField = ColorField;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground bg-background focus:border-primary focus:outline-none";
exports.labelClass = "block text-sm font-medium text-foreground mb-1";
exports.helperClass = "mt-1 text-xs text-muted-foreground";
function Field({ label, helper, children, }) {
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: exports.labelClass, children: label }), children, helper && (0, jsx_runtime_1.jsx)("p", { className: exports.helperClass, children: helper })] }));
}
function ColorField({ label, value, onChange, helper, }) {
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: exports.labelClass, children: label }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "color", value: value || "#000000", onChange: (e) => onChange(e.target.value), className: "h-9 w-9 cursor-pointer rounded border border-border p-0.5 bg-background" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: value, onChange: (e) => onChange(e.target.value), placeholder: "#009688", className: exports.inputClass })] }), helper && (0, jsx_runtime_1.jsx)("p", { className: exports.helperClass, children: helper })] }));
}
//# sourceMappingURL=field-helpers.js.map