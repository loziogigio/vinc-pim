"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormsScreen = FormsScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const adapter_js_1 = require("../adapter.js");
const SubmissionsInbox_js_1 = require("../forms/SubmissionsInbox.js");
const FormDefinitionsTab_js_1 = require("../forms/FormDefinitionsTab.js");
const tabClasses = (active) => `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${active
    ? "border-primary text-primary"
    : "border-transparent text-muted-foreground hover:text-foreground"}`;
/**
 * Forms screen: thin tab shell over the submissions inbox and form-definitions list.
 *
 * Chrome-less except for the tab bar itself, which this screen owns (mirroring CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx`'s tab bar) — the host
 * still renders breadcrumbs/page title and owns the active-tab state via `tab`/
 * `onTabChange`.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function FormsScreen({ tab, onTabChange, storefrontLabel, }) {
    const t = (0, adapter_js_1.useCmsAdminT)();
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex border-b border-border", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: tabClasses(tab === "submissions"), onClick: () => onTabChange?.("submissions"), children: t("pages.b2c.forms.tabSubmissions") }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: tabClasses(tab === "definitions"), onClick: () => onTabChange?.("definitions"), children: t("pages.b2c.forms.tabDefinitions") })] }), tab === "submissions" && (0, jsx_runtime_1.jsx)(SubmissionsInbox_js_1.SubmissionsInbox, {}), tab === "definitions" && (0, jsx_runtime_1.jsx)(FormDefinitionsTab_js_1.FormDefinitionsTab, { storefrontSlug: storefrontLabel ?? "" })] }));
}
//# sourceMappingURL=FormsScreen.js.map