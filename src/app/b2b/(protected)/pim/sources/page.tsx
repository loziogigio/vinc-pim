"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Plus, Settings, Trash2, Edit, CheckCircle2, XCircle, Search, Filter } from "lucide-react";

type ImportSource = {
  _id: string;
  source_id: string;
  source_name: string;
  source_type: "api" | "csv" | "excel" | "xml" | "manual";
  auto_publish_enabled: boolean;
  min_score_threshold: number;
  required_fields: string[];
  is_active: boolean;
  created_at: string;
  stats: {
    total_imports: number;
    total_products: number;
  };
};

export default function SourcesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [sources, setSources] = useState<ImportSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSources();
  }, [searchTerm, typeFilter, currentPage]);

  // Refresh sources when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSources();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [searchTerm, typeFilter, currentPage]);

  async function fetchSources() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (searchTerm) params.append("search", searchTerm);
      if (typeFilter) params.append("type", typeFilter);

      const res = await fetch(`/api/b2b/pim/sources?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(sourceId: string) {
    if (!confirm("Are you sure you want to delete this source?")) return;

    try {
      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error("Error deleting source:", error);
    }
  }

  async function toggleActive(sourceId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error("Error updating source:", error);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Import Sources" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Sources</h1>
          <p className="text-sm text-muted-foreground">
            Configure sources for importing product data ({total} total)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Source
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources by name or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to page 1 on search
            }}
            className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1); // Reset to page 1 on filter
          }}
          className="px-4 py-2 rounded border border-border bg-background text-sm focus:border-primary focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="api">API</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="xml">XML</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Sources List */}
      <div className="grid gap-4">
        {sources.length === 0 ? (
          <div className="rounded-lg bg-card p-12 shadow-sm text-center">
            <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No import sources</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first import source to start importing products
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Source
            </button>
          </div>
        ) : (
          sources.map((source) => (
            <div
              key={source._id}
              className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-primary cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`${tenantPrefix}/b2b/pim/sources/${source.source_id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {source.source_name}
                    </h3>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      {source.source_type?.toUpperCase() || source.type?.toUpperCase() || "UNKNOWN"}
                    </span>
                    {source.is_active ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Source ID: {source.source_id}
                  </p>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Products:</span>
                      <span className="ml-2 font-medium">
                        {source.stats?.total_products || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Imports:</span>
                      <span className="ml-2 font-medium">
                        {source.stats?.total_imports || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Threshold:</span>
                      <span className="ml-2 font-medium">
                        {source.min_score_threshold}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Auto-publish:</span>
                      <span className="ml-2 font-medium">
                        {source.auto_publish_enabled ? "On" : "Off"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(source.source_id, source.is_active)}
                    className="p-2 rounded border border-border hover:bg-muted"
                    title={source.is_active ? "Deactivate" : "Activate"}
                  >
                    {source.is_active ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => router.push(`${tenantPrefix}/b2b/pim/sources/${source.source_id}`)}
                    className="p-2 rounded border border-border hover:bg-muted"
                    title="Edit source"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(source.source_id)}
                    className="p-2 rounded border border-border hover:bg-red-50 hover:border-red-200 text-red-600"
                    title="Delete source"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSourceModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchSources();
          }}
        />
      )}
    </div>
  );
}

function CreateSourceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    source_id: "",
    source_name: "",
    source_type: "csv" as "api" | "csv" | "excel" | "xml" | "manual",
    wholesaler_id: "wholesaler-1", // TODO: Get from session
    auto_publish_enabled: false,
    min_score_threshold: 80,
    required_fields: ["name", "sku", "price", "image"],
    overwrite_level: "automatic" as "automatic" | "manual",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/b2b/pim/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create source");
      }
    } catch (error) {
      console.error("Error creating source:", error);
      alert("Failed to create source");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Create Import Source</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source ID */}
            <div>
              <label className="block text-sm font-medium mb-1">Source ID *</label>
              <input
                type="text"
                required
                value={formData.source_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    source_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                placeholder="e.g., main-erp-feed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Unique identifier (lowercase, alphanumeric and dashes only)
              </p>
            </div>

            {/* Source Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Source Name *</label>
              <input
                type="text"
                required
                value={formData.source_name}
                onChange={(e) => {
                  const name = e.target.value;
                  const id = formData.source_id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  setFormData({ ...formData, source_name: name, source_id: id });
                }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="e.g., Main ERP Feed"
              />
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Source Type *</label>
              <select
                value={formData.source_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    source_type: e.target.value as any,
                  })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="xml">XML</option>
                <option value="api">API</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {/* Auto-publish */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_publish"
                checked={formData.auto_publish_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, auto_publish_enabled: e.target.checked })
                }
                className="rounded border-border"
              />
              <label htmlFor="auto_publish" className="text-sm font-medium">
                Enable auto-publish
              </label>
            </div>

            {/* Threshold */}
            {formData.auto_publish_enabled && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quality Score Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.min_score_threshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_score_threshold: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Products with score above this will auto-publish
                </p>
              </div>
            )}

            {/* Conflict Resolution */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Conflict Resolution
              </label>
              <select
                value={formData.overwrite_level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    overwrite_level: e.target.value as "automatic" | "manual",
                  })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="automatic">Automatic (API always overwrites)</option>
                <option value="manual">Manual (Protect manual edits)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.overwrite_level === "automatic"
                  ? "API updates will always overwrite manual edits without creating conflicts"
                  : "Manual edits will be protected - conflicts created when API tries to update them"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Source"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-border hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
