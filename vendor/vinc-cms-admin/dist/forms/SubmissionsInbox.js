"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionsInbox = SubmissionsInbox;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const adapter_js_1 = require("../adapter.js");
/**
 * Submissions inbox (form submissions list + detail modal).
 *
 * Chrome-less: the host owns breadcrumbs, page title, and the Submissions/Definitions
 * tab bar (see `FormsScreen`). Extracted from CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx`'s submissions-tab portion.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
function SubmissionsInbox() {
    const { client, t } = (0, adapter_js_1.useCmsAdmin)();
    const [submissions, setSubmissions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [page, setPage] = (0, react_1.useState)(1);
    const [totalPages, setTotalPages] = (0, react_1.useState)(1);
    const [, setTotal] = (0, react_1.useState)(0);
    const [selectedSubmission, setSelectedSubmission] = (0, react_1.useState)(null);
    // Filters
    const [filterPage, setFilterPage] = (0, react_1.useState)("");
    const [filterEmail, setFilterEmail] = (0, react_1.useState)("");
    const [filterIp, setFilterIp] = (0, react_1.useState)("");
    const [filterSeen, setFilterSeen] = (0, react_1.useState)("");
    const [filterType, setFilterType] = (0, react_1.useState)("");
    const [filterDateFrom, setFilterDateFrom] = (0, react_1.useState)("");
    const [filterDateTo, setFilterDateTo] = (0, react_1.useState)("");
    const fetchSubmissions = async (p = page) => {
        try {
            setIsLoading(true);
            const result = await client.listSubmissions({
                page: p,
                limit: 25,
                form_type: filterType || undefined,
                ip: filterIp.trim() || undefined,
            });
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
    (0, react_1.useEffect)(() => {
        fetchSubmissions(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterType, filterIp]);
    const handleDelete = async (id) => {
        if (!confirm(t("pages.b2c.formSubmissions.deleteConfirm")))
            return;
        try {
            await client.deleteSubmission(id);
            await fetchSubmissions(page);
        }
        catch {
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
        catch {
            setError(t("pages.b2c.formSubmissions.failedToUpdate"));
        }
    };
    const handleView = (sub) => {
        setSelectedSubmission(sub);
        if (!sub.seen)
            handleToggleSeen(sub);
    };
    const filteredSubmissions = submissions.filter((sub) => {
        if (filterPage && !(sub.page_slug || "").toLowerCase().includes(filterPage.toLowerCase()))
            return false;
        if (filterEmail && !(sub.submitter_email || "").toLowerCase().includes(filterEmail.toLowerCase()))
            return false;
        if (filterIp && !(sub.ip_address || "").toLowerCase().includes(filterIp.toLowerCase()))
            return false;
        if (filterSeen === "seen" && !sub.seen)
            return false;
        if (filterSeen === "unseen" && sub.seen)
            return false;
        if (filterDateFrom) {
            if (new Date(sub.created_at) < new Date(filterDateFrom))
                return false;
        }
        if (filterDateTo) {
            const to = new Date(filterDateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(sub.created_at) > to)
                return false;
        }
        return true;
    });
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400", children: error })), !isLoading && submissions.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterPage, onChange: (e) => setFilterPage(e.target.value), placeholder: t("pages.b2c.formSubmissions.filterByPage"), className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterEmail, onChange: (e) => setFilterEmail(e.target.value), placeholder: t("pages.b2c.formSubmissions.filterByEmail"), className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: filterIp, onChange: (e) => setFilterIp(e.target.value), placeholder: "Filter by IP", className: "h-9 w-44 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("pages.b2c.formSubmissions.allTypes") }), (0, jsx_runtime_1.jsx)("option", { value: "page_form", children: t("pages.b2c.formSubmissions.typePageForm") }), (0, jsx_runtime_1.jsx)("option", { value: "standalone", children: t("pages.b2c.formSubmissions.typeStandalone") })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterSeen, onChange: (e) => setFilterSeen(e.target.value), className: "h-9 w-full sm:w-auto rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: t("common.all") }), (0, jsx_runtime_1.jsx)("option", { value: "unseen", children: t("pages.b2c.formSubmissions.unseen") }), (0, jsx_runtime_1.jsx)("option", { value: "seen", children: t("pages.b2c.formSubmissions.seen") })] }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: filterDateFrom, onChange: (e) => setFilterDateFrom(e.target.value), className: "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", title: t("pages.b2c.formSubmissions.fromDate") }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: filterDateTo, onChange: (e) => setFilterDateTo(e.target.value), className: "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none", title: t("pages.b2c.formSubmissions.toDate") })] })), isLoading && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) })), !isLoading && submissions.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Inbox, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.noSubmissions") })] })), !isLoading && submissions.length > 0 && filteredSubmissions.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.noFilterResults") })] })), !isLoading && filteredSubmissions.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "w-10 px-4 py-3" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.colPage") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.formType") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("common.email") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: "IP" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formSubmissions.colSubmitted") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: filteredSubmissions.map((sub) => ((0, jsx_runtime_1.jsxs)("tr", { className: `hover:bg-muted/50 ${!sub.seen ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`, children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-center", children: !sub.seen && ((0, jsx_runtime_1.jsx)("span", { className: "inline-block h-2.5 w-2.5 rounded-full bg-primary", title: t("pages.b2c.formSubmissions.unseen") })) }), (0, jsx_runtime_1.jsx)("td", { className: `px-4 py-3 text-foreground ${!sub.seen ? "font-semibold" : "font-medium"}`, children: getSourceLabel(sub) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sub.form_type === "standalone"
                                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"}`, children: sub.form_type === "standalone"
                                                        ? t("pages.b2c.formSubmissions.typeStandalone")
                                                        : t("pages.b2c.formSubmissions.typePageForm") }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-muted-foreground", children: sub.submitter_email || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs font-mono text-muted-foreground", children: sub.ip_address || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-xs text-muted-foreground", children: formatDate(sub.created_at) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-3", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleView(sub), className: "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-3.5 w-3.5" }), t("common.view")] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleToggleSeen(sub), className: "rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors", title: sub.seen ? t("pages.b2c.formSubmissions.markAsUnseen") : t("pages.b2c.formSubmissions.markAsSeen"), children: sub.seen ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-3.5 w-3.5" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDelete(sub._id), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }) })] }, sub._id))) })] }) }), totalPages > 1 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formSubmissions.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages)) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", disabled: page <= 1, onClick: () => fetchSubmissions(page - 1), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", disabled: page >= totalPages, onClick: () => fetchSubmissions(page + 1), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-4 w-4" }) })] })] }))] })), selectedSubmission && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "w-full max-w-lg rounded-xl bg-card border border-border shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-b border-border px-6 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-foreground", children: t("pages.b2c.formSubmissions.submissionDetail") }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-muted-foreground", children: [getSourceLabel(selectedSubmission), " \u2014 ", formatDate(selectedSubmission.created_at)] })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setSelectedSubmission(null), className: "rounded-full p-2 text-muted-foreground transition hover:bg-muted", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "max-h-[60vh] overflow-y-auto px-6 py-4", children: [Object.keys(selectedSubmission.data ?? {}).length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: "\u2014" })) : ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsx)("table", { className: "w-full text-sm", children: (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: Object.entries(selectedSubmission.data ?? {}).map(([key, value]) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "py-2 pr-4 font-medium text-foreground capitalize", children: key.replace(/_/g, " ") }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 text-muted-foreground whitespace-pre-wrap", children: typeof value === "object" && value !== null
                                                            ? JSON.stringify(value, null, 2)
                                                            : String(value ?? "—") })] }, key))) }) }) })), selectedSubmission.submitter_email && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-4 text-sm text-muted-foreground", children: [t("pages.b2c.formSubmissions.submitterEmail"), ": ", selectedSubmission.submitter_email] })), selectedSubmission.ip_address && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-sm text-muted-foreground", children: ["IP: ", selectedSubmission.ip_address] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end border-t border-border px-6 py-4", children: (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => setSelectedSubmission(null), children: t("common.close") }) })] }) }))] }));
}
//# sourceMappingURL=SubmissionsInbox.js.map