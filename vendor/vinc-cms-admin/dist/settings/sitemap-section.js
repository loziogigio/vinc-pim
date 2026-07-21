"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitemapSection = SitemapSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const section_card_js_1 = require("./section-card.js");
const field_helpers_js_1 = require("./field-helpers.js");
// ============================================
// COMPONENT
// ============================================
function SitemapSection({ storefrontSlug, apiBasePath, robotsManagedInSeo = false, }) {
    const sitemapApi = apiBasePath ?? `/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`;
    const [data, setData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [regenerating, setRegenerating] = (0, react_1.useState)(false);
    const [validating, setValidating] = (0, react_1.useState)(false);
    const [savingRules, setSavingRules] = (0, react_1.useState)(false);
    const [customRules, setCustomRules] = (0, react_1.useState)("");
    const [message, setMessage] = (0, react_1.useState)(null);
    // URL browser state
    const [browseResult, setBrowseResult] = (0, react_1.useState)(null);
    const [browseLoading, setBrowseLoading] = (0, react_1.useState)(false);
    const [browseType, setBrowseType] = (0, react_1.useState)("all");
    const [browseSearch, setBrowseSearch] = (0, react_1.useState)("");
    const [browsePage, setBrowsePage] = (0, react_1.useState)(1);
    const searchDebounceRef = (0, react_1.useRef)(undefined);
    const showMessage = (0, react_1.useCallback)((type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    }, []);
    // Load sitemap data
    const fetchData = (0, react_1.useCallback)(async () => {
        try {
            const res = await fetch(sitemapApi);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                setCustomRules(json.data.robots_config?.custom_rules || "");
            }
        }
        catch {
            showMessage("error", "Failed to load sitemap data");
        }
        finally {
            setLoading(false);
        }
    }, [sitemapApi, showMessage]);
    (0, react_1.useEffect)(() => {
        fetchData();
    }, [fetchData]);
    // Browse URLs
    const fetchUrls = (0, react_1.useCallback)(async (type, search, page) => {
        setBrowseLoading(true);
        try {
            const res = await fetch(sitemapApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "browse_urls",
                    type: type === "all" ? undefined : type,
                    search: search || undefined,
                    page,
                    limit: 25,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setBrowseResult(json.data);
            }
        }
        catch {
            // Silent fail
        }
        finally {
            setBrowseLoading(false);
        }
    }, [sitemapApi]);
    // Load URLs when sitemap is generated
    (0, react_1.useEffect)(() => {
        if (data?.generated) {
            fetchUrls(browseType, browseSearch, browsePage);
        }
    }, [data?.generated, browseType, browseSearch, browsePage, fetchUrls]);
    // Debounced search
    function handleSearchChange(value) {
        setBrowseSearch(value);
        setBrowsePage(1);
        if (searchDebounceRef.current)
            clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            // The useEffect will trigger fetchUrls
        }, 300);
    }
    function handleTypeChange(type) {
        setBrowseType(type);
        setBrowsePage(1);
    }
    // Regenerate
    async function handleRegenerate() {
        setRegenerating(true);
        try {
            const res = await fetch(sitemapApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "regenerate" }),
            });
            const json = await res.json();
            if (json.success) {
                showMessage("success", `Sitemap regenerated: ${json.data.stats.total_urls} URLs in ${json.data.stats.generation_duration_ms}ms`);
                await fetchData();
                // Reset URL browser
                setBrowsePage(1);
            }
            else {
                showMessage("error", json.error || "Regeneration failed");
            }
        }
        catch {
            showMessage("error", "Network error during regeneration");
        }
        finally {
            setRegenerating(false);
        }
    }
    // Validate
    async function handleValidate() {
        setValidating(true);
        try {
            const res = await fetch(sitemapApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "validate" }),
            });
            const json = await res.json();
            if (json.success) {
                const v = json.data;
                const errCount = v.errors.length;
                const warnCount = v.warnings.length;
                if (errCount === 0 && warnCount === 0) {
                    showMessage("success", "Validation passed — no issues found");
                }
                else {
                    showMessage("error", `Found ${errCount} error(s) and ${warnCount} warning(s)`);
                }
                await fetchData();
            }
        }
        catch {
            showMessage("error", "Validation failed");
        }
        finally {
            setValidating(false);
        }
    }
    // Save custom robots rules
    async function handleSaveRules() {
        setSavingRules(true);
        try {
            const res = await fetch(sitemapApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update_robots_rules", custom_rules: customRules }),
            });
            const json = await res.json();
            if (json.success) {
                showMessage("success", "Custom robots rules saved");
                await fetchData();
            }
            else {
                showMessage("error", json.error || "Failed to save");
            }
        }
        catch {
            showMessage("error", "Network error");
        }
        finally {
            setSavingRules(false);
        }
    }
    if (loading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center p-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-6 w-6 animate-spin text-primary" }) }));
    }
    const stats = data?.stats;
    const validation = data?.validation;
    const disallowRules = data?.robots_config?.disallow || [];
    // Build robots.txt preview
    const robotsPreview = [
        "User-agent: *",
        "Allow: /",
        ...disallowRules.map((d) => `Disallow: ${d}`),
        "",
        "Sitemap: {your-domain}/sitemap.xml",
        ...(customRules ? ["", customRules] : []),
    ].join("\n");
    // URL type config
    const urlTypes = [
        { key: "homepage", label: "Homepage", icon: lucide_react_1.Home, count: stats?.homepage_urls || 0 },
        { key: "page", label: "Pages", icon: lucide_react_1.FileText, count: stats?.page_urls || 0 },
        { key: "product", label: "Products", icon: lucide_react_1.Package, count: stats?.product_urls || 0 },
        { key: "category", label: "Categories", icon: lucide_react_1.FolderTree, count: stats?.category_urls || 0 },
    ];
    // Type badge colors
    const typeBadgeColors = {
        homepage: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
        page: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
        product: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
        category: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    };
    const primaryDomain = browseResult?.primary_domain;
    const pagination = browseResult?.pagination;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [message && ((0, jsx_runtime_1.jsx)("div", { className: `rounded-lg border px-4 py-3 text-sm ${message.type === "success"
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                    : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"}`, children: message.text })), (0, jsx_runtime_1.jsx)(section_card_js_1.SectionCard, { title: "Sitemap Status", description: "Overview of generated sitemap data", children: !data?.generated ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-6", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-muted-foreground text-sm mb-4", children: "No sitemap has been generated yet. Click the button below to generate one." }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleRegenerate, disabled: regenerating, className: "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors", children: [regenerating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" })), regenerating ? "Generating..." : "Generate Sitemap"] })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-4 sm:grid-cols-4", children: urlTypes.map(({ key, label, icon: Icon, count }) => ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-border bg-muted/50 px-4 py-3 text-center", children: [(0, jsx_runtime_1.jsx)(Icon, { className: "mx-auto mb-1 h-5 w-5 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-foreground", children: count }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-muted-foreground", children: label })] }, key))) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-4 text-sm text-muted-foreground", children: [(0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { className: "text-foreground", children: stats?.total_urls || 0 }), " total URLs"] }), (0, jsx_runtime_1.jsx)("span", { className: "text-border", children: "|" }), (0, jsx_runtime_1.jsxs)("span", { children: ["Locales: ", stats?.locales?.join(", ") || "—"] }), (0, jsx_runtime_1.jsx)("span", { className: "text-border", children: "|" }), (0, jsx_runtime_1.jsxs)("span", { children: ["Generated ", stats?.last_generated_at ? timeAgo(stats.last_generated_at) : "—"] }), (0, jsx_runtime_1.jsx)("span", { className: "text-border", children: "|" }), (0, jsx_runtime_1.jsxs)("span", { children: [stats?.generation_duration_ms || 0, "ms"] })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleRegenerate, disabled: regenerating, className: "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors", children: [regenerating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-4 w-4" })), regenerating ? "Regenerating..." : "Regenerate Now"] })] })) }), robotsManagedInSeo ? ((0, jsx_runtime_1.jsx)(section_card_js_1.SectionCard, { title: "robots.txt", description: "Crawler rules share the same source of truth as the public B2B storefront.", children: (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: "Manage allow, disallow, and site-wide indexing in the SEO & Meta Tags section. Those settings are used directly by the storefront's robots.txt endpoint." }) })) : ((0, jsx_runtime_1.jsxs)(section_card_js_1.SectionCard, { title: "robots.txt", description: "Configure crawler access rules", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-foreground mb-1", children: "Generated robots.txt" }), (0, jsx_runtime_1.jsx)("pre", { className: "rounded-lg border border-border bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre", children: robotsPreview })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-foreground mb-1", children: "Custom Rules" }), (0, jsx_runtime_1.jsx)("textarea", { className: field_helpers_js_1.inputClass, rows: 4, value: customRules, onChange: (e) => setCustomRules(e.target.value), placeholder: "# Additional rules\nUser-agent: Googlebot\nAllow: /special-page/" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-muted-foreground", children: "These rules are appended to the auto-generated robots.txt" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleSaveRules, disabled: savingRules, className: "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors", children: [savingRules ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" })), savingRules ? "Saving..." : "Save Rules"] })] })), (0, jsx_runtime_1.jsxs)(section_card_js_1.SectionCard, { title: "Validation", description: "Check sitemap configuration for issues", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: handleValidate, disabled: validating, className: "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors", children: [validating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" })), validating ? "Validating..." : "Run Validation"] }), validation && validation.errors.length === 0 && validation.warnings.length === 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), " All checks passed"] }))] }), validation && validation.errors.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: validation.errors.map((err, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.XCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }), err] }, i))) })), validation && validation.warnings.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: validation.warnings.map((warn, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0" }), warn] }, i))) }))] }), data?.generated && ((0, jsx_runtime_1.jsxs)(section_card_js_1.SectionCard, { title: "URL Browser", description: "Browse, search, and open generated sitemap URLs", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-1", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleTypeChange("all"), className: `rounded-full px-3 py-1 text-xs font-medium transition-colors ${browseType === "all"
                                            ? "bg-foreground text-background"
                                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`, children: ["All (", stats?.total_urls || 0, ")"] }), urlTypes.map(({ key, label, count }) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleTypeChange(key), className: `rounded-full px-3 py-1 text-xs font-medium transition-colors ${browseType === key
                                            ? "bg-foreground text-background"
                                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`, children: [label, " (", count, ")"] }, key)))] }), (0, jsx_runtime_1.jsxs)("div", { className: "relative sm:ml-auto sm:w-64", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search paths...", value: browseSearch, onChange: (e) => handleSearchChange(e.target.value), className: "w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" })] })] }), browseLoading && !browseResult ? ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-8", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-5 w-5 animate-spin text-muted-foreground" }) })) : browseResult && browseResult.urls.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-lg border border-border", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-border bg-muted text-foreground", children: [(0, jsx_runtime_1.jsx)("th", { className: "py-2 px-3 text-left font-medium", children: "Path" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 px-3 text-left font-medium w-24", children: "Type" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 px-3 text-right font-medium w-16", children: "Priority" }), (0, jsx_runtime_1.jsx)("th", { className: "py-2 px-3 text-right font-medium w-20", children: "Freq" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: browseResult.urls.map((u, i) => {
                                        const base = primaryDomain?.startsWith("http")
                                            ? primaryDomain.replace(/\/+$/, "")
                                            : primaryDomain ? `https://${primaryDomain}` : null;
                                        const fullUrl = base ? `${base}${u.path}` : null;
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-muted/50 transition-colors", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-2 px-3", children: fullUrl ? ((0, jsx_runtime_1.jsxs)("a", { href: fullUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 hover:underline", children: [(0, jsx_runtime_1.jsx)("span", { className: "truncate max-w-[400px]", children: u.path }), (0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { className: "h-3 w-3 shrink-0 opacity-60" })] })) : ((0, jsx_runtime_1.jsx)("span", { className: "font-mono text-xs text-foreground truncate max-w-[400px] block", children: u.path })) }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 px-3", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColors[u.type] || "bg-muted text-muted-foreground"}`, children: u.type }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 px-3 text-right text-xs text-muted-foreground", children: u.priority }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 px-3 text-right text-xs text-muted-foreground", children: u.changefreq })] }, i));
                                    }) })] }) })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-center py-8 text-sm text-muted-foreground", children: browseSearch ? "No URLs matching your search" : "No URLs found" })), pagination && pagination.totalPages > 1 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-muted-foreground", children: [pagination.total, " URLs \u2014 page ", pagination.page, " of ", pagination.totalPages] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setBrowsePage((p) => Math.max(1, p - 1)), disabled: pagination.page <= 1 || browseLoading, className: "inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ChevronLeft, { className: "h-3.5 w-3.5" }), " Previous"] }), (0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => setBrowsePage((p) => Math.min(pagination.totalPages, p + 1)), disabled: pagination.page >= pagination.totalPages || browseLoading, className: "inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: ["Next ", (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-3.5 w-3.5" })] })] })] })), browseLoading && browseResult && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-2", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin text-muted-foreground" }) }))] }))] }));
}
// ============================================
// HELPERS
// ============================================
function timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)
        return "just now";
    if (diffMins < 60)
        return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}
//# sourceMappingURL=sitemap-section.js.map