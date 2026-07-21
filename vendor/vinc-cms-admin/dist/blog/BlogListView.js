"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogListView = BlogListView;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
const blog_slug_js_1 = require("./blog-slug.js");
/**
 * Blog posts list + create/settings modals. Extracted from CS
 * `components/blog/BlogListView.tsx`.
 *
 * Transforms from the CS original:
 *  - `useTranslation` -> `useCmsAdmin().t`; `useLanguageStore` -> `adapter.locales`
 *    (first entry = default language). No per-tenant language fetch.
 *  - `blog-api.ts` fetchers -> client methods. The channel picker/column and
 *    `fetchChannels`/`SalesChannelOption` are DROPPED: the storefront IS the channel
 *    (forced server-side), so create/update never send `channels`. Removed UI:
 *      • the "Channels" table column,
 *      • the create-modal "Channels" chip picker (+ `newChannels` state),
 *      • the settings-modal "Channels" TaxPicker.
 *  - CS's `context: BlogChannelContext` prop -> `storefrontLabel?: string` (subtitle label)
 *    + adapter-derived Edit-content link (`links.blogBuilder`) and `LinkComponent`.
 *  - The admin UI locale that CS fed to `fetchPosts({ locale })` -> the first configured
 *    content locale (`locales[0].code`); the package has no separate UI-locale source.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
const PAGE_LIMIT = 20;
function BlogListView({ storefrontLabel }) {
    const { client, t, links, LinkComponent: Link, locales } = (0, adapter_js_1.useCmsAdmin)();
    const languages = (0, react_1.useMemo)(() => (locales && locales.length ? locales : [{ code: "it" }]), [locales]);
    const defaultLang = languages[0]?.code || "it";
    const [items, setItems] = (0, react_1.useState)([]);
    const [total, setTotal] = (0, react_1.useState)(0);
    const [page, setPage] = (0, react_1.useState)(1);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [success, setSuccess] = (0, react_1.useState)(null);
    const [filterQ, setFilterQ] = (0, react_1.useState)("");
    const [filterStatus, setFilterStatus] = (0, react_1.useState)("");
    const [categories, setCategories] = (0, react_1.useState)([]);
    const [tags, setTags] = (0, react_1.useState)([]);
    // New-post modal
    const [showAdd, setShowAdd] = (0, react_1.useState)(false);
    const [newTitle, setNewTitle] = (0, react_1.useState)("");
    const [newSlug, setNewSlug] = (0, react_1.useState)("");
    const [newLocale, setNewLocale] = (0, react_1.useState)("");
    const [isCreating, setIsCreating] = (0, react_1.useState)(false);
    // Settings modal
    const [settingsTarget, setSettingsTarget] = (0, react_1.useState)(null);
    const contentLocaleLabel = (0, react_1.useCallback)((code) => languages.find((l) => l.code === code)?.name || code, [languages]);
    const load = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await client.listBlogPosts({
                locale: defaultLang,
                status: filterStatus || undefined,
                q: filterQ || undefined,
                page,
                limit: PAGE_LIMIT,
            });
            setItems(res.items);
            setTotal(res.pagination.total);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("pages.blog.list.failedToLoad"));
        }
        finally {
            setIsLoading(false);
        }
    }, [client, defaultLang, filterStatus, filterQ, page, t]);
    (0, react_1.useEffect)(() => { load(); }, [load]);
    (0, react_1.useEffect)(() => {
        if (!newLocale && defaultLang)
            setNewLocale(defaultLang);
    }, [defaultLang, newLocale]);
    (0, react_1.useEffect)(() => {
        client.listBlogCategories().then(setCategories).catch(() => { });
        client.listBlogTags().then(setTags).catch(() => { });
    }, [client]);
    const handleCreate = async () => {
        if (!newTitle.trim())
            return;
        setIsCreating(true);
        setError(null);
        try {
            await client.createBlogPost({
                title: newTitle.trim(),
                slug: newSlug.trim() || undefined,
                default_locale: languages.some((l) => l.code === newLocale) ? newLocale : defaultLang,
            });
            setShowAdd(false);
            setNewTitle("");
            setNewSlug("");
            setSuccess(t("pages.blog.list.created"));
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("pages.blog.list.failedToCreate"));
        }
        finally {
            setIsCreating(false);
        }
    };
    const handleDelete = async (post) => {
        if (!confirm(t("pages.blog.list.deleteConfirm").replace("{title}", post.title)))
            return;
        setError(null);
        try {
            await client.deleteBlogPost(post.post_id);
            setSuccess(t("pages.blog.list.deleted"));
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("pages.blog.list.failedToDelete"));
        }
    };
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    const statusClass = (s) => s === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : s === "scheduled" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-muted text-muted-foreground";
    function formatDate(d) {
        if (!d)
            return "—";
        return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-foreground", children: t("pages.blog.list.title") }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.blog.list.subtitle").replace("{label}", storefrontLabel ?? "").replace("{count}", String(total)) })] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: () => setShowAdd(true), className: "inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), " ", t("pages.blog.list.newPost")] })] }), error && (0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400", children: error }), success && (0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400", children: success }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { value: filterQ, onChange: (e) => { setPage(1); setFilterQ(e.target.value); }, placeholder: t("pages.blog.list.filterByTitle"), className: "h-9 w-full min-w-[10rem] max-w-[14rem] rounded-lg border border-border pl-9 pr-3 text-sm focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: (e) => { setPage(1); setFilterStatus(e.target.value); }, className: "h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("pages.blog.list.allStatuses") }), (0, jsx_runtime_1.jsx)("option", { value: "draft", children: t("pages.blog.status.draft") }), (0, jsx_runtime_1.jsx)("option", { value: "scheduled", children: t("pages.blog.status.scheduled") }), (0, jsx_runtime_1.jsx)("option", { value: "published", children: t("pages.blog.status.published") })] })] }), isLoading ? ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) })) : items.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted/50 px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.blog.list.empty") })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-hidden", children: (0, jsx_runtime_1.jsx)("div", { className: "w-full overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full min-w-[640px] text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted/50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.blog.list.colTitle") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("common.status") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell", children: t("pages.blog.list.colLocales") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground hidden lg:table-cell", children: t("pages.blog.list.colUpdated") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: items.map((p) => ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-muted/50", children: [(0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-foreground", children: p.title || t("pages.blog.list.untitled") }), (0, jsx_runtime_1.jsxs)("div", { className: "text-muted-foreground font-mono text-xs", children: ["/", p.slug] })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`, children: t(`pages.blog.status.${p.status}`) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell", children: p.locales.map(contentLocaleLabel).join(", ") }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell", children: formatDate(p.updated_at) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(Link, { href: links.blogBuilder(p.post_id, p.default_locale), className: "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80", children: t("pages.blog.list.editContent") }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSettingsTarget(p), title: t("pages.blog.list.settings"), className: "rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-accent", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings2, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDelete(p), title: t("common.delete"), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }) })] }, p.post_id))) })] }) }) })), totalPages > 1 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-2 text-sm", children: [(0, jsx_runtime_1.jsx)("button", { disabled: page <= 1, onClick: () => setPage((p) => p - 1), className: "rounded border border-border px-3 py-1 text-foreground disabled:opacity-40", children: "\u2039" }), (0, jsx_runtime_1.jsx)("span", { className: "text-muted-foreground", children: t("pages.blog.list.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages)) }), (0, jsx_runtime_1.jsx)("button", { disabled: page >= totalPages, onClick: () => setPage((p) => p + 1), className: "rounded border border-border px-3 py-1 text-foreground disabled:opacity-40", children: "\u203A" })] })), showAdd && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-md rounded-xl bg-card p-6 shadow-2xl", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.blog.list.createTitle") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.list.fieldTitle") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: newTitle, autoFocus: true, onChange: (e) => { setNewTitle(e.target.value); if (!newSlug)
                                                setNewSlug((0, blog_slug_js_1.blogSlugify)(e.target.value)); }, className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.list.fieldSlug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: newSlug, onChange: (e) => setNewSlug((0, blog_slug_js_1.blogSlugify)(e.target.value)), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.list.fieldLocale") }), (0, jsx_runtime_1.jsx)("select", { value: newLocale, onChange: (e) => setNewLocale(e.target.value), className: "mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm", children: languages.map((l) => (0, jsx_runtime_1.jsx)("option", { value: l.code, children: l.name || l.code }, l.code)) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => setShowAdd(false), children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handleCreate, disabled: isCreating || !newTitle.trim(), className: "bg-primary text-primary-foreground hover:bg-primary/90", children: [isCreating ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, t("pages.blog.list.create")] })] })] }) })), settingsTarget && ((0, jsx_runtime_1.jsx)(BlogPostSettingsModal, { post: settingsTarget, categories: categories, tags: tags, onClose: () => setSettingsTarget(null), onSaved: async () => { setSettingsTarget(null); setSuccess(t("pages.blog.list.updated")); await load(); }, onError: setError }))] }));
}
function BlogPostSettingsModal({ post, categories, tags, onClose, onSaved, onError, }) {
    const { client, t } = (0, adapter_js_1.useCmsAdmin)();
    const [slug, setSlug] = (0, react_1.useState)(post.slug);
    const [catIds, setCatIds] = (0, react_1.useState)(post.category_ids);
    const [tagIds, setTagIds] = (0, react_1.useState)(post.tag_ids);
    const [coverUrl, setCoverUrl] = (0, react_1.useState)(post.cover_image?.url || "");
    const [title, setTitle] = (0, react_1.useState)(post.title);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const taxName = (it) => typeof it.name === "string" ? it.name : (it.name.en || it.name.it || Object.values(it.name)[0] || it.slug);
    const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    const save = async () => {
        setSaving(true);
        try {
            await client.updateBlogPost(post.post_id, {
                slug,
                category_ids: catIds,
                tag_ids: tagIds,
                cover_image: coverUrl ? { url: coverUrl } : undefined,
                translation: { locale: post.locale, title },
            });
            onSaved();
        }
        catch (e) {
            onError(e instanceof Error ? e.message : t("pages.blog.list.failedToUpdate"));
        }
        finally {
            setSaving(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.blog.settings.title") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm font-medium text-foreground", children: [t("pages.blog.list.fieldTitle"), " (", post.locale, ")"] }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: title, onChange: (e) => setTitle(e.target.value), className: "mt-1" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.list.fieldSlug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: slug, onChange: (e) => setSlug((0, blog_slug_js_1.blogSlugify)(e.target.value)), className: "mt-1" })] }), (0, jsx_runtime_1.jsx)(TaxPicker, { label: t("nav.blog.categories"), options: categories.map((c) => ({ id: c.category_id, name: taxName(c) })), selected: catIds, onToggle: (id) => toggle(catIds, setCatIds, id) }), (0, jsx_runtime_1.jsx)(TaxPicker, { label: t("nav.blog.tags"), options: tags.map((tg) => ({ id: tg.tag_id, name: taxName(tg) })), selected: tagIds, onToggle: (id) => toggle(tagIds, setTagIds, id) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.blog.settings.coverImageUrl") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: coverUrl, onChange: (e) => setCoverUrl(e.target.value), placeholder: "https://\u2026", className: "mt-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: onClose, children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: save, disabled: saving, className: "bg-primary text-primary-foreground hover:bg-primary/90", children: [saving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, t("common.save")] })] })] }) }));
}
function TaxPicker({ label, options, selected, onToggle }) {
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: label }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 flex flex-wrap gap-2", children: options.length === 0 ? (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground", children: "\u2014" }) : options.map((o) => {
                    const on = selected.includes(o.id);
                    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onToggle(o.id), className: `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`, children: o.name }, o.id));
                }) })] }));
}
//# sourceMappingURL=BlogListView.js.map