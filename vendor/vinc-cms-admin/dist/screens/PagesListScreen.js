"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesListScreen = PagesListScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const adapter_js_1 = require("../adapter.js");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
/**
 * Pages management screen (custom B2C pages list).
 *
 * Chrome-less: the host renders breadcrumbs around this component. Extracted from
 * CS `app/b2b/(protected)/b2c/storefronts/[slug]/pages/page.tsx`.
 *
 * @param storefrontLabel Optional storefront name shown in the subtitle where CS
 *   used the storefront slug. Omit it and the subtitle renders the count only.
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function PagesListScreen({ storefrontLabel } = {}) {
    const { client, t, links, LinkComponent: Link } = (0, adapter_js_1.useCmsAdmin)();
    const [pages, setPages] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [success, setSuccess] = (0, react_1.useState)(null);
    // Search filters
    const [filterTitle, setFilterTitle] = (0, react_1.useState)("");
    const [filterSlug, setFilterSlug] = (0, react_1.useState)("");
    const [filterStatus, setFilterStatus] = (0, react_1.useState)("");
    // Add page dialog
    const [showAddDialog, setShowAddDialog] = (0, react_1.useState)(false);
    const [newTitle, setNewTitle] = (0, react_1.useState)("");
    const [newSlug, setNewSlug] = (0, react_1.useState)("");
    const [isCreating, setIsCreating] = (0, react_1.useState)(false);
    // Rename dialog
    const [renameTarget, setRenameTarget] = (0, react_1.useState)(null);
    const [renameTitle, setRenameTitle] = (0, react_1.useState)("");
    const [renameSlug, setRenameSlug] = (0, react_1.useState)("");
    const [isRenaming, setIsRenaming] = (0, react_1.useState)(false);
    // Duplicate
    const [isDuplicating, setIsDuplicating] = (0, react_1.useState)(null);
    const fetchPages = async () => {
        try {
            const items = await client.listPages();
            setPages(items ?? []);
        }
        catch (err) {
            setError(t("pages.b2c.pagesManagement.failedToLoad"));
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchPages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCreatePage = async () => {
        if (!newTitle.trim() || !newSlug.trim())
            return;
        setIsCreating(true);
        setError(null);
        try {
            await client.createPage({ title: newTitle.trim(), slug: newSlug.trim() });
            setShowAddDialog(false);
            setNewTitle("");
            setNewSlug("");
            setSuccess(t("pages.b2c.pagesManagement.pageCreated"));
            await fetchPages();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("pages.b2c.pagesManagement.failedToCreate"));
        }
        finally {
            setIsCreating(false);
        }
    };
    const handleDeletePage = async (pageSlug) => {
        if (!confirm(t("pages.b2c.pagesManagement.deleteConfirm").replace("{slug}", pageSlug)))
            return;
        setError(null);
        try {
            await client.deletePage(pageSlug);
            setSuccess(t("pages.b2c.pagesManagement.pageDeleted"));
            await fetchPages();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("pages.b2c.pagesManagement.failedToDelete"));
        }
    };
    const handleRenamePage = async () => {
        if (!renameTarget || !renameTitle.trim() || !renameSlug.trim())
            return;
        setIsRenaming(true);
        setError(null);
        try {
            const body = { title: renameTitle.trim() };
            if (renameSlug.trim() !== renameTarget.slug) {
                body.slug = renameSlug.trim();
            }
            await client.renamePage(renameTarget.slug, body);
            setRenameTarget(null);
            setRenameTitle("");
            setRenameSlug("");
            setSuccess(t("pages.b2c.pagesManagement.pageUpdated"));
            await fetchPages();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("pages.b2c.pagesManagement.failedToUpdate"));
        }
        finally {
            setIsRenaming(false);
        }
    };
    const handleDuplicatePage = async (pageSlug) => {
        setIsDuplicating(pageSlug);
        setError(null);
        try {
            const data = await client.duplicatePage(pageSlug);
            setSuccess(t("pages.b2c.pagesManagement.duplicatedAs").replace("{slug}", data.slug || "copy"));
            await fetchPages();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("pages.b2c.pagesManagement.failedToDuplicate"));
        }
        finally {
            setIsDuplicating(null);
        }
    };
    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    };
    const filteredPages = pages.filter((pg) => {
        if (filterTitle && !pg.title.toLowerCase().includes(filterTitle.toLowerCase()))
            return false;
        if (filterSlug && !pg.slug.toLowerCase().includes(filterSlug.toLowerCase()))
            return false;
        if (filterStatus && pg.status !== filterStatus)
            return false;
        return true;
    });
    function formatDate(dateStr) {
        if (!dateStr)
            return "—";
        return new Date(dateStr).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-semibold text-foreground", children: t("pages.b2c.pagesManagement.title") }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.pagesManagement.subtitle").replace("{slug}", storefrontLabel ?? "").replace("{count}", String(pages.length)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)(Link, { href: links.homeBuilder, className: "inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Home, { className: "h-4 w-4" }), t("pages.b2c.pagesManagement.homeBuilder")] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: () => setShowAddDialog(true), className: "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), t("pages.b2c.pagesManagement.addPage")] })] })] }), error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400", children: error })), success && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400", children: success })), !isLoading && pages.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterTitle, onChange: (e) => setFilterTitle(e.target.value), placeholder: t("pages.b2c.pagesManagement.filterByTitle"), className: "h-9 w-48 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterSlug, onChange: (e) => setFilterSlug(e.target.value), placeholder: t("pages.b2c.pagesManagement.filterBySlug"), className: "h-9 w-48 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("pages.b2c.pagesManagement.allStatuses") }), (0, jsx_runtime_1.jsx)("option", { value: "active", children: t("common.active") }), (0, jsx_runtime_1.jsx)("option", { value: "inactive", children: t("common.inactive") })] })] })), isLoading && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) })), !isLoading && pages.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.pagesManagement.noPages") })] })), !isLoading && pages.length > 0 && filteredPages.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.pagesManagement.noFilterResults") })] })), !isLoading && filteredPages.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.pagesManagement.colTitle") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.pagesManagement.colSlug") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("common.status") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.pagesManagement.colContent") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.pagesManagement.colShowInNav") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.pagesManagement.colLastSaved") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: filteredPages.map((pg) => ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-muted/50", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 font-medium text-foreground", children: pg.title }), (0, jsx_runtime_1.jsxs)("td", { className: "px-4 py-3 text-muted-foreground font-mono text-xs", children: ["/", pg.slug] }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pg.status === "active"
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                                : "bg-muted text-muted-foreground"}`, children: pg.status }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)("span", { className: `inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pg.template_status === "published"
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`, children: pg.template_status || "draft" }), pg.has_unpublished_changes && ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400", title: "Unpublished changes", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "h-3 w-3" }) }))] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `text-xs ${pg.show_in_nav ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`, children: pg.show_in_nav ? "Yes" : "No" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground", children: formatDate(pg.last_saved_at || pg.updated_at) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(Link, { href: links.pageBuilder(pg.slug), className: "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors", children: t("common.edit") }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => { setRenameTarget(pg); setRenameTitle(pg.title); setRenameSlug(pg.slug); }, className: "rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors", title: t("pages.b2c.pagesManagement.rename"), children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDuplicatePage(pg.slug), disabled: isDuplicating === pg.slug, className: "rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50", title: t("common.duplicate"), children: isDuplicating === pg.slug ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-3.5 w-3.5 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-3.5 w-3.5" })) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDeletePage(pg.slug), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors", title: t("common.delete"), children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }) })] }, pg._id))) })] }) })), showAddDialog && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.b2c.pagesManagement.createNewPage") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.pagesManagement.pageTitle") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: newTitle, onChange: (e) => {
                                                setNewTitle(e.target.value);
                                                if (!newSlug || newSlug === generateSlug(newTitle)) {
                                                    setNewSlug(generateSlug(e.target.value));
                                                }
                                            }, placeholder: t("pages.b2c.pagesManagement.pageTitlePlaceholder"), className: "mt-1", autoFocus: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.pagesManagement.urlSlug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: newSlug, onChange: (e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")), placeholder: t("pages.b2c.pagesManagement.urlSlugPlaceholder"), className: "mt-1" }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-muted-foreground", children: [t("pages.b2c.pagesManagement.urlPath"), ": /", newSlug || "..."] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => {
                                        setShowAddDialog(false);
                                        setNewTitle("");
                                        setNewSlug("");
                                    }, children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handleCreatePage, disabled: isCreating || !newTitle.trim() || !newSlug.trim(), className: "bg-primary text-primary-foreground hover:bg-primary/90", children: [isCreating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : null, t("pages.b2c.pagesManagement.createPage")] })] })] }) })), renameTarget && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.b2c.pagesManagement.editPage") }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.pagesManagement.pageTitle") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: renameTitle, onChange: (e) => setRenameTitle(e.target.value), placeholder: t("pages.b2c.pagesManagement.pageTitle"), className: "mt-1", autoFocus: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.pagesManagement.urlSlug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: renameSlug, onChange: (e) => setRenameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")), placeholder: t("pages.b2c.pagesManagement.urlSlugPlaceholder"), className: "mt-1", onKeyDown: (e) => {
                                                if (e.key === "Enter")
                                                    handleRenamePage();
                                            } }), (0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-xs text-muted-foreground", children: [t("pages.b2c.pagesManagement.urlPath"), ": /", renameSlug || "...", renameSlug !== renameTarget.slug && ((0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-amber-600 dark:text-amber-400", children: t("pages.b2c.pagesManagement.slugChangeWarning") }))] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => { setRenameTarget(null); setRenameTitle(""); setRenameSlug(""); }, children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handleRenamePage, disabled: isRenaming ||
                                        !renameTitle.trim() ||
                                        !renameSlug.trim() ||
                                        (renameTitle.trim() === renameTarget.title && renameSlug.trim() === renameTarget.slug), className: "bg-primary text-primary-foreground hover:bg-primary/90", children: [isRenaming ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" })) : null, t("common.save")] })] })] }) }))] }));
}
//# sourceMappingURL=PagesListScreen.js.map