"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Home,
  FileText,
  Package,
  FolderTree,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SectionCard } from "./section-card";
import { inputClass } from "./field-helpers";

// ============================================
// TYPES
// ============================================

interface SitemapStats {
  total_urls: number;
  homepage_urls: number;
  page_urls: number;
  product_urls: number;
  category_urls: number;
  locales: string[];
  last_generated_at: string;
  generation_duration_ms: number;
}

interface SitemapValidation {
  warnings: string[];
  errors: string[];
  last_validated_at: string;
}

interface RobotsConfig {
  custom_rules: string;
  disallow: string[];
}

interface SitemapData {
  generated: boolean;
  stats: SitemapStats | null;
  robots_config: RobotsConfig;
  validation: SitemapValidation | null;
  url_count: number;
}

interface SitemapUrl {
  path: string;
  type: string;
  lastmod?: string;
  changefreq: string;
  priority: number;
}

interface UrlBrowseResult {
  urls: SitemapUrl[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  primary_domain: string | null;
}

// ============================================
// COMPONENT
// ============================================

export function SitemapSection({ storefrontSlug }: { storefrontSlug: string }) {
  const [data, setData] = useState<SitemapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [customRules, setCustomRules] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // URL browser state
  const [browseResult, setBrowseResult] = useState<UrlBrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseType, setBrowseType] = useState("all");
  const [browseSearch, setBrowseSearch] = useState("");
  const [browsePage, setBrowsePage] = useState(1);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  // Load sitemap data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setCustomRules(json.data.robots_config?.custom_rules || "");
      }
    } catch {
      showMessage("error", "Failed to load sitemap data");
    } finally {
      setLoading(false);
    }
  }, [storefrontSlug, showMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Browse URLs
  const fetchUrls = useCallback(
    async (type: string, search: string, page: number) => {
      setBrowseLoading(true);
      try {
        const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`, {
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
      } catch {
        // Silent fail
      } finally {
        setBrowseLoading(false);
      }
    },
    [storefrontSlug]
  );

  // Load URLs when sitemap is generated
  useEffect(() => {
    if (data?.generated) {
      fetchUrls(browseType, browseSearch, browsePage);
    }
  }, [data?.generated, browseType, browseSearch, browsePage, fetchUrls]);

  // Debounced search
  function handleSearchChange(value: string) {
    setBrowseSearch(value);
    setBrowsePage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      // The useEffect will trigger fetchUrls
    }, 300);
  }

  function handleTypeChange(type: string) {
    setBrowseType(type);
    setBrowsePage(1);
  }

  // Regenerate
  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`, {
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
      } else {
        showMessage("error", json.error || "Regeneration failed");
      }
    } catch {
      showMessage("error", "Network error during regeneration");
    } finally {
      setRegenerating(false);
    }
  }

  // Validate
  async function handleValidate() {
    setValidating(true);
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate" }),
      });
      const json = await res.json();
      if (json.success) {
        const v = json.data as SitemapValidation;
        const errCount = v.errors.length;
        const warnCount = v.warnings.length;
        if (errCount === 0 && warnCount === 0) {
          showMessage("success", "Validation passed — no issues found");
        } else {
          showMessage("error", `Found ${errCount} error(s) and ${warnCount} warning(s)`);
        }
        await fetchData();
      }
    } catch {
      showMessage("error", "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  // Save custom robots rules
  async function handleSaveRules() {
    setSavingRules(true);
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_robots_rules", custom_rules: customRules }),
      });
      const json = await res.json();
      if (json.success) {
        showMessage("success", "Custom robots rules saved");
        await fetchData();
      } else {
        showMessage("error", json.error || "Failed to save");
      }
    } catch {
      showMessage("error", "Network error");
    } finally {
      setSavingRules(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#009688]" />
      </div>
    );
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
    { key: "homepage", label: "Homepage", icon: Home, count: stats?.homepage_urls || 0 },
    { key: "page", label: "Pages", icon: FileText, count: stats?.page_urls || 0 },
    { key: "product", label: "Products", icon: Package, count: stats?.product_urls || 0 },
    { key: "category", label: "Categories", icon: FolderTree, count: stats?.category_urls || 0 },
  ];

  // Type badge colors
  const typeBadgeColors: Record<string, string> = {
    homepage: "bg-blue-100 text-blue-700",
    page: "bg-purple-100 text-purple-700",
    product: "bg-amber-100 text-amber-700",
    category: "bg-emerald-100 text-emerald-700",
  };

  const primaryDomain = browseResult?.primary_domain;
  const pagination = browseResult?.pagination;

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Card 1: Sitemap Status */}
      <SectionCard title="Sitemap Status" description="Overview of generated sitemap data">
        {!data?.generated ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm mb-4">
              No sitemap has been generated yet. Click the button below to generate one.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {regenerating ? "Generating..." : "Generate Sitemap"}
            </button>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {urlTypes.map(({ key, label, icon: Icon, count }) => (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-center"
                >
                  <Icon className="mx-auto mb-1 h-5 w-5 text-slate-400" />
                  <div className="text-2xl font-bold text-slate-800">{count}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span>
                <strong className="text-slate-700">{stats?.total_urls || 0}</strong> total URLs
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Locales: {stats?.locales?.join(", ") || "—"}
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Generated {stats?.last_generated_at ? timeAgo(stats.last_generated_at) : "—"}
              </span>
              <span className="text-slate-300">|</span>
              <span>{stats?.generation_duration_ms || 0}ms</span>
            </div>

            {/* Regenerate button */}
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {regenerating ? "Regenerating..." : "Regenerate Now"}
            </button>
          </>
        )}
      </SectionCard>

      {/* Card 2: robots.txt */}
      <SectionCard title="robots.txt" description="Configure crawler access rules">
        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Generated robots.txt
          </label>
          <pre className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-700 overflow-x-auto whitespace-pre">
            {robotsPreview}
          </pre>
        </div>

        {/* Custom rules */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Custom Rules
          </label>
          <textarea
            className={inputClass}
            rows={4}
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            placeholder={"# Additional rules\nUser-agent: Googlebot\nAllow: /special-page/"}
          />
          <p className="mt-1 text-xs text-slate-500">
            These rules are appended to the auto-generated robots.txt
          </p>
        </div>

        {/* Save */}
        <button
          onClick={handleSaveRules}
          disabled={savingRules}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
        >
          {savingRules ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {savingRules ? "Saving..." : "Save Rules"}
        </button>
      </SectionCard>

      {/* Card 3: Validation */}
      <SectionCard title="Validation" description="Check sitemap configuration for issues">
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {validating ? "Validating..." : "Run Validation"}
          </button>

          {validation && validation.errors.length === 0 && validation.warnings.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> All checks passed
            </span>
          )}
        </div>

        {/* Errors */}
        {validation && validation.errors.length > 0 && (
          <div className="space-y-2">
            {validation.errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {err}
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {validation && validation.warnings.length > 0 && (
          <div className="space-y-2">
            {validation.warnings.map((warn, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {warn}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Card 4: URL Browser */}
      {data?.generated && (
        <SectionCard title="URL Browser" description="Browse, search, and open generated sitemap URLs">
          {/* Filters row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Type filter tabs */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleTypeChange("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  browseType === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({stats?.total_urls || 0})
              </button>
              {urlTypes.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChange(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    browseType === key
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search paths..."
                value={browseSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#009688] focus:outline-none focus:ring-1 focus:ring-[#009688]"
              />
            </div>
          </div>

          {/* Table */}
          {browseLoading && !browseResult ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : browseResult && browseResult.urls.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2 px-3 text-left font-medium">Path</th>
                    <th className="py-2 px-3 text-left font-medium w-24">Type</th>
                    <th className="py-2 px-3 text-right font-medium w-16">Priority</th>
                    <th className="py-2 px-3 text-right font-medium w-20">Freq</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {browseResult.urls.map((u, i) => {
                    const base = primaryDomain?.startsWith("http")
                      ? primaryDomain.replace(/\/+$/, "")
                      : primaryDomain ? `https://${primaryDomain}` : null;
                    const fullUrl = base ? `${base}${u.path}` : null;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-3">
                          {fullUrl ? (
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-xs text-[#009688] hover:text-[#00796b] hover:underline"
                            >
                              <span className="truncate max-w-[400px]">{u.path}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-slate-700 truncate max-w-[400px] block">
                              {u.path}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              typeBadgeColors[u.type] || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {u.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-500">
                          {u.priority}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-500">
                          {u.changefreq}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-slate-400">
              {browseSearch ? "No URLs matching your search" : "No URLs found"}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {pagination.total} URLs — page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || browseLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => setBrowsePage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages || browseLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay for page transitions */}
          {browseLoading && browseResult && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
