"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorefrontSettingsScreen = StorefrontSettingsScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const seo_section_js_1 = require("../settings/seo-section.js");
const scripts_section_js_1 = require("../settings/scripts-section.js");
const css_section_js_1 = require("../settings/css-section.js");
const sitemap_section_js_1 = require("../settings/sitemap-section.js");
const TAB_SECTIONS = [
    { id: "seo", label: "SEO" },
    { id: "scripts", label: "Scripts" },
    { id: "css", label: "CSS" },
];
/**
 * Storefront settings screen (SEO / Scripts / CSS / Sitemap).
 *
 * Chrome-less: the host renders breadcrumbs/page title and owns the active-section
 * state via `section`/`onSectionChange`. Mirrors CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/page.tsx`'s metaTags/customScripts/
 * customCss seeding and save handlers.
 *
 * The Save button in every section PATCHes ONLY `{ meta_tags, custom_scripts,
 * custom_css }` — never `name`/`channel`/`domains` (office security contract).
 * A failed save never discards the in-progress edit; it only surfaces the
 * `CmsAdminError` message in the error banner.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function StorefrontSettingsScreen({ section, onSectionChange, storefrontLabel, }) {
    const { client, uploadFile } = (0, adapter_js_1.useCmsAdmin)();
    const [metaTags, setMetaTags] = (0, react_1.useState)({});
    const [customScripts, setCustomScripts] = (0, react_1.useState)([]);
    const [customCss, setCustomCss] = (0, react_1.useState)("");
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const loadStorefront = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError(null);
        try {
            const sf = await client.getStorefront();
            setMetaTags(sf.meta_tags ?? {});
            setCustomScripts(sf.custom_scripts ?? []);
            setCustomCss(sf.custom_css ?? "");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load storefront settings");
        }
        finally {
            setLoading(false);
        }
    }, [client]);
    (0, react_1.useEffect)(() => {
        loadStorefront();
    }, [loadStorefront]);
    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const updated = await client.updateStorefront({
                meta_tags: metaTags,
                custom_scripts: customScripts,
                custom_css: customCss,
            });
            setMetaTags(updated.meta_tags ?? {});
            setCustomScripts(updated.custom_scripts ?? []);
            setCustomCss(updated.custom_css ?? "");
        }
        catch (err) {
            // Never reset metaTags/customScripts/customCss here — the operator's edit
            // must survive a failed save so they can retry without redoing the work.
            setError(err instanceof Error ? err.message : "Failed to save storefront settings");
        }
        finally {
            setSaving(false);
        }
    }
    function handleMetaTagsChange(key, value) {
        setMetaTags((prev) => ({ ...prev, [key]: value }));
    }
    if (loading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center p-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6 p-6", children: [storefrontLabel && ((0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-foreground", children: storefrontLabel })), error && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400", children: [(0, jsx_runtime_1.jsx)("span", { children: error }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: loadStorefront, className: "shrink-0 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors", children: "Retry" })] })), onSectionChange && section !== "sitemap" && ((0, jsx_runtime_1.jsx)("div", { className: "flex gap-1 border-b border-border", children: TAB_SECTIONS.map((tab) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onSectionChange(tab.id), className: `border-b-2 px-4 py-2 text-sm font-medium transition-colors ${section === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"}`, children: tab.label }, tab.id))) })), section === "seo" && ((0, jsx_runtime_1.jsx)(seo_section_js_1.SeoSection, { metaTags: metaTags, onChange: handleMetaTagsChange, saving: saving, onSave: handleSave })), section === "scripts" && ((0, jsx_runtime_1.jsx)(scripts_section_js_1.ScriptsSection, { scripts: customScripts, onChange: setCustomScripts, saving: saving, onSave: handleSave, onUploadFile: uploadFile })), section === "css" && ((0, jsx_runtime_1.jsx)(css_section_js_1.CssSection, { css: customCss, onChange: setCustomCss, saving: saving, onSave: handleSave })), section === "sitemap" && ((0, jsx_runtime_1.jsx)(sitemap_section_js_1.SitemapSection, { storefrontSlug: storefrontLabel ?? "", apiBasePath: `${client.apiBase}/sitemap` }))] }));
}
//# sourceMappingURL=StorefrontSettingsScreen.js.map