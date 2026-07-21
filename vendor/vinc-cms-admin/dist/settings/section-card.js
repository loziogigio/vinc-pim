"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionCard = SectionCard;
const jsx_runtime_1 = require("react/jsx-runtime");
function SectionCard({ title, description, children, }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-border bg-card shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "border-b border-border px-6 py-5", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: description })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-6 px-6 py-6", children: children })] }));
}
//# sourceMappingURL=section-card.js.map