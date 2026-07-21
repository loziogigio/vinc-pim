"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogTaxonomyManager = BlogTaxonomyManager;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
const blog_slug_js_1 = require("./blog-slug.js");
/**
 * Blog categories/tags manager (list + create/edit/delete modal). Extracted from CS
 * `components/blog/BlogTaxonomyManager.tsx`.
 *
 * Transforms: `useTranslation` -> `useCmsAdmin().t`; `useLanguageStore` -> `adapter.locales`
 * (first entry = default language, used to key the name map); `blog-api.ts` fetchers ->
 * client methods (`listBlogCategories`/`createBlogCategory`/`updateBlogCategory`/… and the
 * tag equivalents). Update uses the wrapper's PUT verb (CS used PATCH on its tenant route).
 * The create/update body never carries `channels` (server forces the storefront channel).
 *
 * Exported for hosts that mount taxonomy management on their own route (mirroring CS's
 * tenant-level `/b2b/blog/categories` + `/b2b/blog/tags` pages); it is not part of BlogScreen.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function BlogTaxonomyManager({ kind }) {
    const { client, t, locales } = (0, adapter_js_1.useCmsAdmin)();
    const languages = (0, react_1.useMemo)(() => (locales && locales.length ? locales : [{ code: "it" }]), [locales]);
    const defaultLang = languages[0]?.code || "it";
    const idKey = kind === "categories" ? "category_id" : "tag_id";
    const [items, setItems] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [success, setSuccess] = (0, react_1.useState)(null);
    const [editing, setEditing] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setItems(kind === "categories" ? await client.listBlogCategories() : await client.listBlogTags());
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToSave"));
        }
        finally {
            setIsLoading(false);
        }
    }, [client, kind, t]);
    (0, react_1.useEffect)(() => { load(); }, [load]);
    const nameStr = (it) => typeof it.name === "string" ? it.name : (it.name[defaultLang] || it.name.en || Object.values(it.name)[0] || it.slug);
    const remove = async (it) => {
        if (!confirm(t("pages.blog.taxonomy.deleteConfirm").replace("{name}", nameStr(it))))
            return;
        try {
            const id = it[idKey];
            if (kind === "categories")
                await client.deleteBlogCategory(id);
            else
                await client.deleteBlogTag(id);
            setSuccess(t("pages.blog.taxonomy.deleted"));
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToDelete"));
        }
    };
    const title = kind === "categories" ? t("pages.blog.taxonomy.categoriesTitle") : t("pages.blog.taxonomy.tagsTitle");
    const newLabel = kind === "categories" ? t("pages.blog.taxonomy.newCategory") : t("pages.blog.taxonomy.newTag");
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-foreground", children: title }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: () => setEditing("new"), className: "inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), " ", newLabel] })] }), error && (0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400", children: error }), success && (0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400", children: success }), isLoading ? ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) })) : items.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted/50 px-6 py-12 text-center text-sm text-muted-foreground", children: t("pages.blog.taxonomy.empty") })) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-hidden", children: (0, jsx_runtime_1.jsx)("div", { className: "w-full overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[480px] text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted/50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.blog.taxonomy.name") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.blog.taxonomy.slug") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell", children: t("pages.blog.taxonomy.posts") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell", children: t("pages.blog.taxonomy.active") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: items.map((it) => ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-muted/50", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 font-medium text-foreground", children: nameStr(it) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 font-mono text-xs text-muted-foreground", children: it.slug }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell", children: it.post_count }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs hidden sm:table-cell", children: it.is_active ? "✓" : "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setEditing(it), className: "rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-accent", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => remove(it), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }) })] }, it[idKey]))) })] }) }) })), editing && ((0, jsx_runtime_1.jsx)(TaxonomyModal, { kind: kind, defaultLang: defaultLang, item: editing === "new" ? null : editing, onClose: () => setEditing(null), onSaved: async () => { setEditing(null); setSuccess(t("pages.blog.taxonomy.created")); await load(); }, onError: setError }))] }));
}
function TaxonomyModal({ kind, defaultLang, item, onClose, onSaved, onError }) {
    const { client, t } = (0, adapter_js_1.useCmsAdmin)();
    const idKey = kind === "categories" ? "category_id" : "tag_id";
    const initialName = item ? (typeof item.name === "string" ? item.name : Object.values(item.name)[0] || "") : "";
    const [name, setName] = (0, react_1.useState)(initialName);
    const [slug, setSlug] = (0, react_1.useState)(item?.slug || "");
    const [color, setColor] = (0, react_1.useState)(item?.color || "");
    const [isActive, setIsActive] = (0, react_1.useState)(item?.is_active ?? true);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const save = async () => {
        if (!name.trim())
            return;
        setSaving(true);
        try {
            const body = {
                name: { [defaultLang]: name.trim() },
                slug: slug.trim() || undefined,
                is_active: isActive,
                ...(kind === "tags" ? { color: color || undefined } : {}),
            };
            const id = item ? item[idKey] : null;
            if (kind === "categories") {
                if (id)
                    await client.updateBlogCategory(id, body);
                else
                    await client.createBlogCategory(body);
            }
            else {
                if (id)
                    await client.updateBlogTag(id, body);
                else
                    await client.createBlogTag(body);
            }
            onSaved();
        }
        catch (e) {
            onError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToSave"));
        }
        finally {
            setSaving(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-md rounded-xl bg-card p-6 shadow-2xl", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: kind === "categories" ? t("pages.blog.taxonomy.categoriesTitle") : t("pages.blog.taxonomy.tagsTitle") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.taxonomy.name") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: name, autoFocus: true, onChange: (e) => { setName(e.target.value); if (!item && !slug)
                                        setSlug((0, blog_slug_js_1.blogSlugify)(e.target.value)); }, className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.taxonomy.slug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: slug, onChange: (e) => setSlug((0, blog_slug_js_1.blogSlugify)(e.target.value)), className: "mt-1" })] }), kind === "tags" && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.taxonomy.color") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: color, onChange: (e) => setColor(e.target.value), placeholder: "#009688", className: "mt-1" })] })), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-foreground", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: isActive, onChange: (e) => setIsActive(e.target.checked) }), " ", t("pages.blog.taxonomy.active")] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: onClose, children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: save, disabled: saving || !name.trim(), className: "bg-primary text-primary-foreground hover:bg-primary/90", children: [saving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, t("common.save")] })] })] }) }));
}
//# sourceMappingURL=BlogTaxonomyManager.js.map