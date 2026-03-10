"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Home,
  FileText,
  Package,
  FolderTree,
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

  // URL preview
  const [previewUrls, setPreviewUrls] = useState<SitemapUrl[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

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
        // Refresh preview
        setPreviewUrls([]);
        setExpandedTypes(new Set());
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

  // Load URL preview (from public endpoint via admin)
  async function loadPreviewUrls() {
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${storefrontSlug}/sitemap`);
      const json = await res.json();
      if (!json.success) return;

      // Fetch the full sitemap data including URLs from the public API
      // We'll use a separate endpoint that returns URLs for preview
      const publicRes = await fetch(`/api/b2b/b2c/public/sitemap-data`, {
        headers: { Origin: window.location.origin },
      });
      if (publicRes.ok) {
        const publicJson = await publicRes.json();
        setPreviewUrls(publicJson.urls || []);
      }
    } catch {
      // Silent fail — preview is optional
    }
  }

  // Toggle URL type expansion
  function toggleType(type: string) {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    // Load preview URLs on first expand
    if (previewUrls.length === 0) {
      loadPreviewUrls();
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

      {/* Card 4: URL Preview */}
      {data?.generated && (
        <SectionCard title="URL Preview" description="Browse generated sitemap entries by type">
          <div className="space-y-2">
            {urlTypes.map(({ key, label, icon: Icon, count }) => (
              <div key={key} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleType(key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                >
                  {expandedTypes.has(key) ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {count}
                  </span>
                </button>

                {expandedTypes.has(key) && (
                  <div className="border-t border-slate-200 px-4 py-2">
                    {previewUrls.length === 0 ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading preview...
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                              <th className="py-1.5 text-left font-medium">Path</th>
                              <th className="py-1.5 text-right font-medium w-16">Priority</th>
                              <th className="py-1.5 text-right font-medium w-20">Freq</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewUrls
                              .filter((u) => u.type === key)
                              .slice(0, 20)
                              .map((u, i) => (
                                <tr key={i} className="border-b border-slate-50">
                                  <td className="py-1.5 text-slate-700 font-mono truncate max-w-[400px]">
                                    {u.path}
                                  </td>
                                  <td className="py-1.5 text-right text-slate-500">{u.priority}</td>
                                  <td className="py-1.5 text-right text-slate-500">{u.changefreq}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {previewUrls.filter((u) => u.type === key).length > 20 && (
                          <p className="py-2 text-xs text-slate-400 text-center">
                            Showing 20 of {previewUrls.filter((u) => u.type === key).length} URLs
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
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
