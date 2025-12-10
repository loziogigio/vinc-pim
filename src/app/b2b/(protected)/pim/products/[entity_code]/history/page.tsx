"use client";

import { use, useEffect, useState } from "react";
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
} from "lucide-react";
import { VersionComparison } from "@/components/pim/VersionComparison";
import { getLocalizedString } from "@/lib/types/pim";

type ProductVersion = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  description?: string;
  version: number;
  isCurrent: boolean;
  isCurrentPublished: boolean;
  status: "draft" | "published" | "archived";
  published_at?: string;
  images?: { url: string; cdn_key?: string; position?: number }[];
  brand?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
  completeness_score: number;
  critical_issues: string[];
  source: {
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

export default function ProductHistoryPage({
  params,
}: {
  params: Promise<{ entity_code: string }>;
}) {
  const { entity_code } = use(params);
  const router = useRouter();
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [compareV1, setCompareV1] = useState<number | null>(null);
  const [compareV2, setCompareV2] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [editTypeFilter, setEditTypeFilter] = useState<"all" | "manual" | "api">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7days" | "30days">("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [entity_code]);

  async function fetchVersions() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entity_code}/history`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      } else if (res.status === 404) {
        router.push("/b2b/pim/products");
      }
    } catch (error) {
      console.error("Error fetching product history:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

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
        // Replace the first selected version
        return [prev[1], version];
      }
    });
  }

  function handleCompare() {
    if (selectedVersions.length === 2) {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      setCompareV1(v1);
      setCompareV2(v2);
      setShowComparison(true);
    }
  }

  async function handleRollback(targetVersion: number) {
    const currentVersion = versions.find((v) => v.isCurrent);
    if (!currentVersion) return;

    const confirmed = confirm(
      `Are you sure you want to rollback to version ${targetVersion}?\n\n` +
        `This will create a new version (v${currentVersion.version + 1}) with the data from version ${targetVersion}.\n` +
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

      // Refresh versions list
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
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "draft":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "archived":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "published":
        return "bg-emerald-100 text-emerald-700";
      case "draft":
        return "bg-amber-100 text-amber-700";
      case "archived":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function applyFilters(versions: ProductVersion[]): ProductVersion[] {
    return versions.filter((version) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = getLocalizedString(version.name).toLowerCase().includes(query);
        const matchesDescription = getLocalizedString(version.description).toLowerCase().includes(query);
        const matchesSku = version.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription && !matchesSku) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && version.status !== statusFilter) {
        return false;
      }

      // Edit type filter
      if (editTypeFilter === "manual" && !version.manually_edited) {
        return false;
      }
      if (editTypeFilter === "api" && version.manually_edited) {
        return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const versionDate = new Date(version.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - versionDate.getTime()) / 86400000);

        if (dateFilter === "7days" && daysDiff > 7) {
          return false;
        }
        if (dateFilter === "30days" && daysDiff > 30) {
          return false;
        }
      }

      return true;
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setEditTypeFilter("all");
    setDateFilter("all");
  }

  const filteredVersions = applyFilters(versions);
  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    editTypeFilter !== "all" ||
    dateFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const currentProduct = versions.find((v) => v.isCurrent);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Products", href: "/b2b/pim/products" },
          {
            label: (() => {
              if (!currentProduct?.name) return entity_code;
              if (typeof currentProduct.name === "string") return currentProduct.name;
              // Extract from multilingual object - prefer Italian, then English, then first available
              return currentProduct.name.it || currentProduct.name.en || Object.values(currentProduct.name)[0] || entity_code;
            })(),
            href: `/b2b/pim/products/${entity_code}`,
          },
          { label: "Version History" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/b2b/pim/products/${entity_code}`}
            className="p-2 rounded border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Version History</h1>
            <p className="text-sm text-muted-foreground">
              {getLocalizedString(currentProduct?.name)} • {filteredVersions.length} of {versions.length} version
              {versions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
            hasActiveFilters
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "border-border hover:bg-muted"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {[
                searchQuery ? 1 : 0,
                statusFilter !== "all" ? 1 : 0,
                editTypeFilter !== "all" ? 1 : 0,
                dateFilter !== "all" ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
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
              <label className="block text-sm font-medium text-foreground mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, SKU, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Edit Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Edit Type</label>
              <select
                value={editTypeFilter}
                onChange={(e) => setEditTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual Edits</option>
                <option value="api">API Imports</option>
              </select>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDateFilter("all")}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  dateFilter === "all"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-background border border-border hover:bg-muted"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("7days")}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  dateFilter === "7days"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-background border border-border hover:bg-muted"
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("30days")}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  dateFilter === "30days"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-background border border-border hover:bg-muted"
                }`}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredVersions.length} of {versions.length} versions
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <X className="h-4 w-4" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Current Product Info */}
      {currentProduct && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded overflow-hidden bg-white flex-shrink-0">
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
                  <h3 className="font-semibold text-foreground">{getLocalizedString(currentProduct.name)}</h3>
                  <p className="text-sm text-muted-foreground">
                    SKU: {currentProduct.sku} • Version {currentProduct.version}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    currentProduct.status
                  )}`}
                >
                  Current
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Selection Bar */}
      {selectedVersions.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {selectedVersions.length === 1
                    ? "1 version selected"
                    : `${selectedVersions.length} versions selected`}
                </p>
                <p className="text-xs text-blue-700">
                  {selectedVersions.length === 1
                    ? "Select one more version to compare"
                    : "Click Compare to see differences"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedVersions([])}
                className="px-3 py-1 text-sm text-blue-700 hover:text-blue-900 font-medium"
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
                Compare Versions
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
              Version Timeline
            </h2>
            <p className="text-xs text-gray-500">
              Select 2 versions to compare • Click rollback to restore old version
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredVersions.length === 0 ? (
            <div className="p-12 text-center">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No versions found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your filters to see more results
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            filteredVersions.map((version, index) => (
              <div
                key={version._id}
                className={`p-4 hover:bg-muted/30 transition ${
                  version.isCurrent ? "bg-blue-50/50" : ""
                } ${selectedVersions.includes(version.version) ? "bg-blue-100/50 border-l-4 border-blue-500" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* Selection Checkbox */}
                  <div className="flex-shrink-0 pt-2">
                    <input
                      type="checkbox"
                      checked={selectedVersions.includes(version.version)}
                      onChange={() => handleVersionSelect(version.version)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  {/* Version Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        version.isCurrent
                          ? "bg-blue-600 text-white"
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
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{getLocalizedString(version.name)}</h3>
                        <p className="text-xs text-muted-foreground">{version.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {version.isCurrent && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            Current
                          </span>
                        )}
                        {version.isCurrentPublished && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                            Published
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            version.status
                          )}`}
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
                      <div className="flex items-center gap-1">
                        <span>Source: {version.source.source_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Quality: {version.completeness_score}%</span>
                      </div>
                    </div>

                    {/* Description Preview */}
                    {version.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {version.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/b2b/pim/products/${entity_code}?version=${version.version}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded border border-border hover:bg-muted text-sm"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Link>
                      {!version.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRollback(version.version)}
                          disabled={rollingBack}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Rollback
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connection Line */}
                {index < filteredVersions.length - 1 && (
                  <div className="ml-5 mt-2 mb-2 h-4 border-l-2 border-dashed border-border"></div>
                )}
              </div>
            ))
          )}
        </div>
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
