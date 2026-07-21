"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CssSection = CssSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const section_card_js_1 = require("./section-card.js");
const adapter_js_1 = require("../adapter.js");
const textareaClass = "w-full rounded-lg border border-border px-4 py-3 text-sm font-mono text-foreground bg-background focus:border-primary focus:ring-1 focus:ring-primary";
/**
 * Single custom-CSS editor. Shared by the B2B portal and B2C storefront detail
 * pages — the CSS is injected into the storefront <head> as one <style> block.
 */
function CssSection({ css, onChange, saving, onSave, }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)(section_card_js_1.SectionCard, { title: t("components.cssSection.title"), description: t("components.cssSection.description"), children: [(0, jsx_runtime_1.jsx)("textarea", { value: css, onChange: (e) => onChange(e.target.value), rows: 18, spellCheck: false, placeholder: t("components.cssSection.placeholder"), className: textareaClass }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground", children: t("components.cssSection.hint") })] }), (0, jsx_runtime_1.jsx)("div", { className: "pt-2", children: (0, jsx_runtime_1.jsxs)("button", { onClick: onSave, disabled: saving, className: "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors", children: [saving ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" })), saving
                            ? t("components.cssSection.saving")
                            : t("components.cssSection.save")] }) })] }));
}
//# sourceMappingURL=css-section.js.map