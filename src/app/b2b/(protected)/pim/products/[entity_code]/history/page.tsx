"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  GitBranch,
  Calendar,
  User,
  ArrowLeftRight,
  RotateCcw,
  AlertCircle,
  Filter,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { VersionComparison } from "@/components/pim/VersionComparison";
import { getLocalizedString } from "@/lib/types/pim";
import { useTranslation } from "@/lib/i18n/useTranslation";

type ProductVersion = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  description?: string | Record<string, string>;
  version: number;
  isCurrent: boolean;
  isCurrentPublished: boolean;
  status: "draft" | "published" | "archived";
  published_at?: string;
  images?: { url: string; cdn_key?: string; position?: number }[];
  brand?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
  completeness_score?: number;
  critical_issues?: string[];
  source?: {
    source_id: string;
    source_name: string;
    imported_at: string;
  };
  manually_edited: boolean;
  edited_by?: string;
  edited_at?: string;
  created_at: string;
  updated_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StatusFilter = "all" | "draft" | "published" | "archived";
type EditTypeFilter = "all" | "manual" | "api";
type DateFilter = "all" | "7days" | "30days" | "custom";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export default function ProductHistoryPage({
  params,
}: {
  params: Promise<{ entity_code: string }>;
}) {
  const { entity_code } = use(params);
  const router = useRouter();
  const { t } = useTranslation();

  const [items, setItems] = useState<ProductVersion[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [compareV1, setCompareV1] = useState<number | null>(null);
  const [compareV2, setCompareV2] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Filters — `searchQuery` is the live input; `debouncedSearch` is what hits the API.
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editTypeFilter, setEditTypeFilter] = useState<EditTypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Track the "current" product across all versions (not just the current page)
  // so the header/breadcrumb keep working when the user paginates past v1.
  const [headerProduct, setHeaderProduct] = useState<ProductVersion | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(DEFAULT_PAGE_SIZE);

  // Debounce search input → debouncedSearch
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Whenever a filter changes, snap back to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, editTypeFilter, dateFilter, dateFrom, dateTo, perPage]);

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      statusFilter !== "all" ||
      editTypeFilter !== "all" ||
      dateFilter !== "all" ||
      dateFrom !== "" ||
      dateTo !== "",
    [debouncedSearch, statusFilter, editTypeFilter, dateFilter, dateFrom, dateTo]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        debouncedSearch ? 1 : 0,
        statusFilter !== "all" ? 1 : 0,
        editTypeFilter !== "all" ? 1 : 0,
        dateFilter !== "all" || dateFrom || dateTo ? 1 : 0,
      ].reduce<number>((a, b) => a + Number(b), 0),
    [debouncedSearch, statusFilter, editTypeFilter, dateFilter, dateFrom, dateTo]
  );

  const buildQueryString = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", String(perPage));
    if (debouncedSearch) sp.set("search", debouncedSearch);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (editTypeFilter !== "all") sp.set("editType", editTypeFilter);
    if (dateFilter !== "all" && dateFilter !== "custom") sp.set("dateRange", dateFilter);
    if (dateFrom) sp.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) sp.set("dateTo", new Date(dateTo).toISOString());
    return sp.toString();
  }, [page, perPage, debouncedSearch, statusFilter, editTypeFilter, dateFilter, dateFrom, dateTo]);

  // Cancel in-flight requests when the query changes so the user always sees the
  // response for the latest filter/page combination.
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchVersions = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/b2b/pim/products/${entity_code}/history?${buildQueryString()}`,
        { signal: controller.signal }
      );
      if (res.status === 404) {
        router.push("/b2b/pim/products");
        return;
      }
      if (!res.ok) {
        console.error("Error fetching product history:", res.status);
        setItems([]);
        return;
      }
      const data = await res.json();
      const nextItems: ProductVersion[] = data.items || [];
      setItems(nextItems);
      setPagination(
        data.pagination || { page, limit: perPage, total: nextItems.length, totalPages: 1 }
      );

      // Cache the "current" record the first time we see it so header info
      // survives navigating to a later page that doesn't include it.
      const current = nextItems.find((v) => v.isCurrent);
      if (current) setHeaderProduct(current);
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        console.error("Error fetching product history:", error);
        setItems([]);
      }
    } finally {
      // If we were superseded by a newer request, leave its loading flag alone.
      if (fetchAbortRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [entity_code, router, buildQueryString, page, perPage]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function handleVersionSelect(version: number) {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      } else if (prev.length < 2) {
        return [...prev, version];
      } else {
        return [prev[1], version];
      }
    });
  }

  function handleCompare() {
    if (selectedVersions.length === 2) {
      const [v1, v2] = [...selectedVersions].sort((a, b) => a - b);
      setCompareV1(v1);
      setCompareV2(v2);
      setShowComparison(true);
    }
  }

  async function handleRollback(targetVersion: number) {
    const current = headerProduct ?? items.find((v) => v.isCurrent);
    if (!current) return;

    const confirmed = confirm(
      `Are you sure you want to rollback to version ${targetVersion}?\n\n` +
        `This will create a new version (v${current.version + 1}) with the data from version ${targetVersion}.\n` +
        `The current version will be preserved in history.`
    );
    if (!confirmed) return;

    setRollingBack(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_version: targetVersion }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to rollback");
      }

      const data = await res.json();
      alert(`✅ Successfully rolled back to version ${targetVersion}!\n\nNew version: v${data.new_version}`);

      await fetchVersions();
      router.push(`/b2b/pim/products/${entity_code}`);
    } catch (error) {
      console.error("Error rolling back:", error);
      alert(`Failed to rollback: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRollingBack(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "published":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "draft":
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "archived":
        return <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
      default:
        return null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "published":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
      case "draft":
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
      case "archived":
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300";
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setEditTypeFilter("all");
    setDateFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  // First-load skeleton (no header cache yet, still fetching).
  if (isLoading && !headerProduct && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
        <div className="h-96 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  const currentProduct = headerProduct;
  const showingFrom = items.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = (pagination.page - 1) * pagination.limit + items.length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.pim.breadcrumb"), href: "/b2b/pim" },
          { label: t("pages.pim.products.title"), href: "/b2b/pim/products" },
          {
            label: (() => {
              if (!currentProduct?.name) return entity_code;
              if (typeof currentProduct.name === "string") return currentProduct.name;
              return (
                currentProduct.name.it ||
                currentProduct.name.en ||
                Object.values(currentProduct.name)[0] ||
                entity_code
              );
            })(),
            href: `/b2b/pim/products/${entity_code}`,
          },
          { label: t("pages.pim.history.title") },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={`/b2b/pim/products/${entity_code}`}
            className="p-2 rounded border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("pages.pim.history.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {getLocalizedString(currentProduct?.name)} •{" "}
              {t("pages.pim.history.countSummary", {
                shown: String(showingTo),
                total: String(pagination.total),
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
            hasActiveFilters
              ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/40 dark:text-blue-300"
              : "border-border hover:bg-muted"
          }`}
        >
          <Filter className="h-4 w-4" />
          {t("common.filters")}
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 dark:bg-blue-500 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-lg bg-card border border-border p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("common.search")}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("pages.pim.history.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("common.status")}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Edit Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("pages.pim.history.editType")}
              </label>
              <select
                value={editTypeFilter}
                onChange={(e) => setEditTypeFilter(e.target.value as EditTypeFilter)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual Edits</option>
                <option value="api">API Imports</option>
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("pages.pim.history.dateRange")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { value: "all", label: t("pages.pim.history.allTime") },
                  { value: "7days", label: t("pages.pim.history.last7Days") },
                  { value: "30days", label: t("pages.pim.history.last30Days") },
                  { value: "custom", label: t("pages.pim.history.customRange") },
                ] as { value: DateFilter; label: string }[]
              ).map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setDateFilter(preset.value);
                    if (preset.value !== "custom") {
                      setDateFrom("");
                      setDateTo("");
                    }
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    dateFilter === preset.value
                      ? "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40"
                      : "bg-background border border-border hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {dateFilter === "custom" && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("pages.pim.history.dateFrom")}
                  </label>
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("pages.pim.history.dateTo")}
                  </label>
                  <input
                    type="datetime-local"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("pages.pim.history.countSummary", {
                  shown: String(showingTo),
                  total: String(pagination.total),
                })}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                <X className="h-4 w-4" />
                {t("pages.pim.history.clearAllFilters")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Current Product Info */}
      {currentProduct && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded overflow-hidden bg-card flex-shrink-0">
              {currentProduct.images?.[0]?.url && (
                <Image
                  src={currentProduct.images[0].url}
                  alt={getLocalizedString(currentProduct.name)}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {getLocalizedString(currentProduct.name)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    SKU: {currentProduct.sku} • Version {currentProduct.version}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(currentProduct.status)}`}>
                  Current
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Selection Bar */}
      {selectedVersions.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  {selectedVersions.length === 1
                    ? "1 version selected"
                    : `${selectedVersions.length} versions selected`}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {selectedVersions.length === 1
                    ? "Select one more version to compare"
                    : "Click Compare to see differences"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedVersions([])}
                className="px-3 py-1 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleCompare}
                disabled={selectedVersions.length !== 2}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                {t("pages.pim.history.compareVersions")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version Timeline */}
      <div className="rounded-lg bg-card shadow-sm border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {t("pages.pim.history.versionTimeline")}
            </h2>
            <p className="text-xs text-muted-foreground">
              Select 2 versions to compare • Click rollback to restore old version
            </p>
          </div>
        </div>

        <div className="divide-y divide-border relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center pointer-events-none">
              <div className="h-6 w-6 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {items.length === 0 && !isLoading ? (
            <div className="p-12 text-center">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("pages.pim.history.noVersionsFound")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your filters to see more results
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                >
                  {t("pages.pim.history.clearAllFilters")}
                </button>
              )}
            </div>
          ) : (
            items.map((version, index) => (
              <div
                key={version._id}
                className={`p-4 hover:bg-muted/30 transition ${
                  version.isCurrent ? "bg-blue-50/50 dark:bg-blue-500/5" : ""
                } ${selectedVersions.includes(version.version) ? "bg-blue-100/50 border-l-4 border-blue-500 dark:bg-blue-500/10 dark:border-blue-500/60" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* Selection Checkbox */}
                  <div className="flex-shrink-0 pt-2">
                    <input
                      type="checkbox"
                      checked={selectedVersions.includes(version.version)}
                      onChange={() => handleVersionSelect(version.version)}
                      className="w-4 h-4 text-primary rounded cursor-pointer"
                    />
                  </div>

                  {/* Version Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        version.isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      v{version.version}
                    </div>
                  </div>

                  {/* Product Thumbnail */}
                  <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                    {version.images?.[0]?.url && (
                      <Image
                        src={version.images[0].url}
                        alt={getLocalizedString(version.name)}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Version Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {getLocalizedString(version.name)}
                        </h3>
                        <p className="text-xs text-muted-foreground">{version.sku}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {version.isCurrent && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                            Current
                          </span>
                        )}
                        {version.isCurrentPublished && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            Published
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(version.status)}`}
                        >
                          {version.status}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatTimeAgo(version.created_at)}</span>
                      </div>
                      {version.manually_edited && version.edited_by && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Edited by {version.edited_by}</span>
                        </div>
                      )}
                      {version.source?.source_name && (
                        <div className="flex items-center gap-1">
                          <span>Source: {version.source.source_name}</span>
                        </div>
                      )}
                      {version.completeness_score !== undefined && (
                        <div className="flex items-center gap-1">
                          <span>Quality: {version.completeness_score}%</span>
                        </div>
                      )}
                    </div>

                    {/* Description Preview */}
                    {version.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {getLocalizedString(version.description)}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/b2b/pim/products/${entity_code}?version=${version.version}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded border border-border hover:bg-muted text-sm"
                      >
                        <Eye className="h-3 w-3" />
                        {t("common.view")}
                      </Link>
                      {!version.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRollback(version.version)}
                          disabled={rollingBack}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:text-orange-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t("pages.pim.history.rollback")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {index < items.length - 1 && (
                  <div className="ml-5 mt-2 mb-2 h-4 border-l-2 border-dashed border-border"></div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pager */}
        {pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/30 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>
                {showingFrom}–{showingTo} / {pagination.total}
              </span>
              <label className="flex items-center gap-2">
                <span>{t("pages.pim.history.perPage")}:</span>
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.previous")}
              </button>
              <span className="px-2 text-muted-foreground">
                {t("pages.pim.history.pageOf", {
                  page: String(pagination.page),
                  totalPages: String(pagination.totalPages),
                })}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Version Comparison Modal */}
      {showComparison && compareV1 && compareV2 && (
        <VersionComparison
          entityCode={entity_code}
          v1={compareV1}
          v2={compareV2}
          onClose={() => {
            setShowComparison(false);
            setSelectedVersions([]);
          }}
        />
      )}
    </div>
  );
}
