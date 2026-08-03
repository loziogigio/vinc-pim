"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionsInbox = SubmissionsInbox;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const adapter_js_1 = require("../adapter.js");
const client_js_1 = require("../client.js");
const PAGE_SIZE = 25;
/** Text inputs refetch on a trailing debounce so typing doesn't fire a request per keystroke. */
const FILTER_DEBOUNCE_MS = 300;
/**
 * Submissions inbox (form submissions list + detail modal).
 *
 * Chrome-less: the host owns breadcrumbs, page title, and the Submissions/Definitions
 * tab bar (see `FormsScreen`). Extracted from CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx`'s submissions-tab portion.
 *
 * Filtering, pagination, selection and CSV export all happen server-side — this
 * component never filters `submissions` itself.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function SubmissionsInbox({ onWriteError } = {}) {
    const { client, t } = (0, adapter_js_1.useCmsAdmin)();
    const [submissions, setSubmissions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [page, setPage] = (0, react_1.useState)(1);
    const [totalPages, setTotalPages] = (0, react_1.useState)(1);
    const [total, setTotal] = (0, react_1.useState)(0);
    const [selectedSubmission, setSelectedSubmission] = (0, react_1.useState)(null);
    // Filters — all applied server-side.
    const [filterPage, setFilterPage] = (0, react_1.useState)("");
    const [filterEmail, setFilterEmail] = (0, react_1.useState)("");
    const [filterIp, setFilterIp] = (0, react_1.useState)("");
    const [filterSeen, setFilterSeen] = (0, react_1.useState)("");
    const [filterType, setFilterType] = (0, react_1.useState)("");
    const [filterDateFrom, setFilterDateFrom] = (0, react_1.useState)("");
    const [filterDateTo, setFilterDateTo] = (0, react_1.useState)("");
    // The three text filters are debounced independently of the selects/dates: typing
    // shouldn't fire a request per keystroke, but a select/date change should refetch
    // immediately. `debouncedText` trails `filterPage`/`filterEmail`/`filterIp` by
    // FILTER_DEBOUNCE_MS; the select/date states feed straight into `filters` below.
    const [debouncedText, setDebouncedText] = (0, react_1.useState)({ page: "", email: "", ip: "" });
    (0, react_1.useEffect)(() => {
        const timer = setTimeout(() => {
            setDebouncedText({ page: filterPage, email: filterEmail, ip: filterIp });
        }, FILTER_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [filterPage, filterEmail, filterIp]);
    // Selection — mirrors the PIM products page: a set of ids that survives paging,
    // plus a separate "everything matching the filters" escalation.
    const [selectedIds, setSelectedIds] = (0, react_1.useState)(new Set());
    const [selectAllMatching, setSelectAllMatching] = (0, react_1.useState)(false);
    const [isExporting, setIsExporting] = (0, react_1.useState)(false);
    const [exportError, setExportError] = (0, react_1.useState)(null);
    const filters = (0, react_1.useMemo)(() => ({
        page_slug: debouncedText.page.trim() || undefined,
        email: debouncedText.email.trim() || undefined,
        ip: debouncedText.ip.trim() || undefined,
        seen: filterSeen || undefined,
        form_type: filterType || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
    }), [debouncedText, filterSeen, filterType, filterDateFrom, filterDateTo]);
    const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);
    const clearSelection = () => {
        setSelectedIds(new Set());
        setSelectAllMatching(false);
    };
    const fetchSubmissions = async (p) => {
        try {
            setIsLoading(true);
            const result = await client.listSubmissions({ page: p, limit: PAGE_SIZE, ...filters });
            setSubmissions(result.items || []);
            setTotalPages(result.pagination?.totalPages || 1);
            setTotal(result.pagination?.total || 0);
            setPage(p);
        }
        catch (err) {
            setError(t("pages.b2c.formSubmissions.failedToLoad"));
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    // A filter change resets to page 1 and drops the selection — the previously
    // ticked rows no longer correspond to what is on screen. Selects/dates land in
    // `filters` immediately; text inputs land after their own debounce above, so this
    // effect itself does not need a second debounce.
    const isFirstRun = (0, react_1.useRef)(true);
    (0, react_1.useEffect)(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            void fetchSubmissions(1);
            return;
        }
        clearSelection();
        void fetchSubmissions(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);
    const handleDelete = async (id) => {
        if (!confirm(t("pages.b2c.formSubmissions.deleteConfirm")))
            return;
        try {
            await client.deleteSubmission(id);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            await fetchSubmissions(page);
        }
        catch (err) {
            if (err instanceof client_js_1.CmsAdminError && onWriteError?.(err))
                return;
            setError(t("pages.b2c.formSubmissions.failedToDelete"));
        }
    };
    const handleToggleSeen = async (sub) => {
        try {
            await client.setSubmissionSeen(sub._id, !sub.seen);
            setSubmissions((prev) => prev.map((s) => (s._id === sub._id ? { ...s, seen: !s.seen } : s)));
            if (selectedSubmission?._id === sub._id) {
                setSelectedSubmission({ ...sub, seen: !sub.seen });
            }
        }
        catch (err) {
            if (err instanceof client_js_1.CmsAdminError && onWriteError?.(err))
                return;
            setError(t("pages.b2c.formSubmissions.failedToUpdate"));
        }
    };
    const handleView = (sub) => {
        setSelectedSubmission(sub);
        if (!sub.seen)
            void handleToggleSeen(sub);
    };
    const toggleRow = (id) => {
        setSelectAllMatching(false);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const isAllOnPageSelected = submissions.length > 0 && submissions.every((s) => selectedIds.has(s._id));
    const isSomeOnPageSelected = submissions.some((s) => selectedIds.has(s._id)) && !isAllOnPageSelected;
    const toggleSelectAllOnPage = () => {
        setSelectAllMatching(false);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (isAllOnPageSelected)
                submissions.forEach((s) => next.delete(s._id));
            else
                submissions.forEach((s) => next.add(s._id));
            return next;
        });
    };
    const handleExport = async () => {
        setExportError(null);
        setIsExporting(true);
        try {
            const blob = selectAllMatching
                ? await client.exportSubmissions({ all_matching: true, filters })
                : await client.exportSubmissions({ submission_ids: Array.from(selectedIds) });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `form-submissions-${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
        }
        catch (err) {
            const cmsError = err;
            if (cmsError?.code === "EXPORT_TOO_LARGE") {
                setExportError(t("pages.b2c.formSubmissions.exportTooLarge", {
                    total: String(cmsError.details?.total ?? ""),
                }));
            }
            else if (cmsError?.code === "NO_ROWS") {
                setExportError(t("pages.b2c.formSubmissions.exportNoRows"));
            }
            else {
                setExportError(t("pages.b2c.formSubmissions.exportFailed"));
            }
        }
        finally {
            setIsExporting(false);
        }
    };
    const formatDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleString();
        }
        catch {
            return dateStr;
        }
    };
    const getSourceLabel = (sub) => {
        if (sub.form_type === "standalone" && sub.form_definition_slug) {
            return sub.form_definition_slug.replace(/_/g, " ");
        }
        return sub.page_slug ? `/${sub.page_slug}` : "—";
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400", children: error })), !isLoading && (submissions.length > 0 || hasActiveFilters) && ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterPage, onChange: (e) => setFilterPage(e.target.value), placeholder: t("pages.b2c.formSubmissions.filterByPage"), className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterEmail, onChange: (e) => setFilterEmail(e.target.value), placeholder: t("pages.b2c.formSubmissions.filterByEmail"), className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterIp, onChange: (e) => setFilterIp(e.target.value), placeholder: "Filter by IP", className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("pages.b2c.formSubmissions.allTypes") }), (0, jsx_runtime_1.jsx)("option", { value: "page_form", children: t("pages.b2c.formSubmissions.typePageForm") }), (0, jsx_runtime_1.jsx)("option", { value: "standalone", children: t("pages.b2c.formSubmissions.typeStandalone") })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterSeen, onChange: (e) => setFilterSeen(e.target.value), className: "h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("common.all") }), (0, jsx_runtime_1.jsx)("option", { value: "unseen", children: t("pages.b2c.formSubmissions.unseen") }), (0, jsx_runtime_1.jsx)("option", { value: "seen", children: t("pages.b2c.formSubmissions.seen") })] }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: filterDateFrom, onChange: (e) => setFilterDateFrom(e.target.value), className: "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", title: t("pages.b2c.formSubmissions.fromDate") }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: filterDateTo, onChange: (e) => setFilterDateTo(e.target.value), className: "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", title: t("pages.b2c.formSubmissions.toDate") })] })), (selectedIds.size > 0 || selectAllMatching) && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-primary/20 bg-primary/10 p-4 shadow-sm space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 min-w-0", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-foreground", children: selectAllMatching
                                            ? t("pages.b2c.formSubmissions.allMatchingSelected", { total: String(total) })
                                            : t("pages.b2c.formSubmissions.selectedCount", { count: String(selectedIds.size) }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: clearSelection, className: "text-sm text-muted-foreground underline hover:text-foreground", children: t("pages.b2c.formSubmissions.clearSelection") })] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: handleExport, disabled: isExporting, className: "flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60", children: [isExporting ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" })), isExporting
                                        ? t("pages.b2c.formSubmissions.exporting")
                                        : t("pages.b2c.formSubmissions.exportCsv")] })] }), isAllOnPageSelected && !selectAllMatching && total > submissions.length && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center text-sm text-muted-foreground", children: [t("pages.b2c.formSubmissions.allOnPageSelected", { count: String(submissions.length) }), " ", (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSelectAllMatching(true), className: "font-medium text-primary hover:underline", children: t("pages.b2c.formSubmissions.selectAllMatching", { total: String(total) }) })] })), exportError && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-600 dark:text-red-400", children: exportError })] })), isLoading && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) })), !isLoading && total === 0 && !hasActiveFilters && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Inbox, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.noSubmissions") })] })), !isLoading && total === 0 && hasActiveFilters && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.noFilterResults") })] })), !isLoading && submissions.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "w-10 px-4 py-3", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: isAllOnPageSelected, ref: (el) => {
                                                        if (el)
                                                            el.indeterminate = isSomeOnPageSelected;
                                                    }, onChange: toggleSelectAllOnPage, "aria-label": t("pages.b2c.formSubmissions.selectAllOnPage"), className: "h-4 w-4 cursor-pointer rounded border-border" }) }), (0, jsx_runtime_1.jsx)("th", { className: "w-10 px-4 py-3" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.colPage") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.formType") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("common.email") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: "IP" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.colSubmitted") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: submissions.map((sub) => ((0, jsx_runtime_1.jsxs)("tr", { className: `hover:bg-muted/50 ${!sub.seen ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`, children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-center", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedIds.has(sub._id), onChange: () => toggleRow(sub._id), "aria-label": t("pages.b2c.formSubmissions.selectRow"), className: "h-4 w-4 cursor-pointer rounded border-border" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-center", children: !sub.seen && ((0, jsx_runtime_1.jsx)("span", { className: "inline-block h-2.5 w-2.5 rounded-full bg-primary", title: t("pages.b2c.formSubmissions.unseen") })) }), (0, jsx_runtime_1.jsx)("td", { className: `px-4 py-3 text-foreground ${!sub.seen ? "font-semibold" : "font-medium"}`, children: getSourceLabel(sub) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sub.form_type === "standalone"
                                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"}`, children: sub.form_type === "standalone"
                                                        ? t("pages.b2c.formSubmissions.typeStandalone")
                                                        : t("pages.b2c.formSubmissions.typePageForm") }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-muted-foreground", children: sub.submitter_email || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs font-mono text-muted-foreground", children: sub.ip_address || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground", children: formatDate(sub.created_at) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-3", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleView(sub), className: "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-3.5 w-3.5" }), t("common.view")] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleToggleSeen(sub), className: "rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors", title: sub.seen ? t("pages.b2c.formSubmissions.markAsUnseen") : t("pages.b2c.formSubmissions.markAsSeen"), children: sub.seen ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-3.5 w-3.5" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDelete(sub._id), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }) })] }, sub._id))) })] }) }), totalPages > 1 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages)) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", disabled: page <= 1, onClick: () => fetchSubmissions(page - 1), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", disabled: page >= totalPages, onClick: () => fetchSubmissions(page + 1), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-4 w-4" }) })] })] }))] })), selectedSubmission && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-lg rounded-xl bg-card border border-border shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-b border-border px-6 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.b2c.formSubmissions.submissionDetail") }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-muted-foreground", children: [getSourceLabel(selectedSubmission), " \u2014 ", formatDate(selectedSubmission.created_at)] })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSelectedSubmission(null), className: "rounded-full p-2 text-muted-foreground transition hover:bg-muted", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "max-h-[60vh] overflow-y-auto px-6 py-4", children: [Object.keys(selectedSubmission.data ?? {}).length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: "\u2014" })) : ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsx)("table", { className: "w-full text-sm", children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: Object.entries(selectedSubmission.data ?? {}).map(([key, value]) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "py-2 pr-4 font-medium text-foreground capitalize", children: key.replace(/_/g, " ") }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 text-muted-foreground whitespace-pre-wrap", children: typeof value === "object" && value !== null
                                                            ? JSON.stringify(value, null, 2)
                                                            : String(value ?? "—") })] }, key))) }) }) })), selectedSubmission.submitter_email && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-4 text-sm text-muted-foreground", children: [t("pages.b2c.formSubmissions.submitterEmail"), ": ", selectedSubmission.submitter_email] })), selectedSubmission.ip_address && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-sm text-muted-foreground", children: ["IP: ", selectedSubmission.ip_address] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end border-t border-border px-6 py-4", children: (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => setSelectedSubmission(null), children: t("common.close") }) })] }) }))] }));
}
//# sourceMappingURL=SubmissionsInbox.js.map