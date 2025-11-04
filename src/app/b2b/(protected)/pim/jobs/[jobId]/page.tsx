"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  Database,
  FileText,
  Calendar,
  Timer,
} from "lucide-react";

type Product = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string;
  long_description?: string;
  price?: any;
  category?: any;
  brand?: any;
  quantity?: number;
  image?: {
    id?: string;
    thumbnail?: string;
    original?: string;
  };
  status: string;
  completeness_score?: number;
  created_at: string;
  updated_at: string;
  source?: {
    source_id: string;
    job_id: string;
    import_date: string;
  };
};

type ImportJob = {
  job_id: string;
  source_id: string;
  batch_id?: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  auto_published_count: number;
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
  import_errors: {
    row: number;
    entity_code: string;
    error: string;
    raw_data?: any;
  }[];
};

export default function ImportJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<ImportJob | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId, pagination.page, search, statusFilter]);

  async function fetchJobDetails() {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/b2b/pim/jobs/${jobId}/items?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setProducts(data.products || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching job details:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleItemExpansion(itemId: string) {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  }

  // Combine successful products and failed items into one displayable list
  function getCombinedItems() {
    const items: Array<Product | { isFailed: true; error: any }> = [];

    // Add successful products
    products.forEach((product) => {
      items.push(product);
    });

    // Add failed items from import_errors (if showing them)
    if (job?.import_errors && !showOnlyFailed) {
      // Don't duplicate - failed items are shown separately in pagination
    }

    // Filter by search if needed
    if (showOnlyFailed && job?.import_errors) {
      return job.import_errors.map(err => ({
        isFailed: true as const,
        error: err
      }));
    }

    return items;
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "completed":
      case "published":
        return "bg-emerald-100 text-emerald-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "pending":
      case "draft":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function formatDuration(seconds?: number) {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Import Jobs", href: "/b2b/pim/jobs" },
          { label: `Job ${jobId.slice(0, 8)}...` },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/b2b/pim/jobs")}
            className="p-2 rounded hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Import Job Details</h1>
            <p className="text-sm text-muted-foreground">Job ID: {job.job_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(job.status)}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
              job.status
            )}`}
          >
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Job Summary */}
      <div className="rounded-lg bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Database className="h-4 w-4" />
              Source ID
            </div>
            <div className="font-medium">{job.source_id}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Package className="h-4 w-4" />
              Total Rows
            </div>
            <div className="font-medium">{job.total_rows}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Successful
            </div>
            {job.batch_id ? (
              <Link
                href={`/b2b/pim/products?batch_id=${job.batch_id}`}
                className="font-medium text-emerald-600 hover:underline cursor-pointer"
                title="View all products from this batch"
              >
                {job.successful_rows}
              </Link>
            ) : (
              <div className="font-medium text-emerald-600">{job.successful_rows}</div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <XCircle className="h-4 w-4" />
              Failed
            </div>
            <div className="font-medium text-red-600">{job.failed_rows}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <FileText className="h-4 w-4" />
              Auto-published
            </div>
            {job.batch_id ? (
              <Link
                href={`/b2b/pim/products?batch_id=${job.batch_id}&status=published`}
                className="font-medium text-blue-600 hover:underline cursor-pointer"
                title="View published products from this batch"
              >
                {job.auto_published_count}
              </Link>
            ) : (
              <div className="font-medium text-blue-600">{job.auto_published_count}</div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Timer className="h-4 w-4" />
              Duration
            </div>
            <div className="font-medium">{formatDuration(job.duration_seconds)}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Started
            </div>
            <div className="font-medium text-xs">{formatDate(job.created_at)}</div>
          </div>
          {job.completed_at && (
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Calendar className="h-4 w-4" />
                Completed
              </div>
              <div className="font-medium text-xs">{formatDate(job.completed_at)}</div>
            </div>
          )}
        </div>

        {/* Import Errors */}
        {job.import_errors && job.import_errors.length > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-3">
                  {job.import_errors.length} errors occurred:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {job.import_errors.map((error, idx) => (
                    <div key={idx} className="p-2 bg-white rounded text-xs">
                      <span className="font-medium">Row {error.row}</span>
                      {error.entity_code && (
                        <span className="text-muted-foreground ml-2">
                          ({error.entity_code})
                        </span>
                      )}
                      <p className="text-red-700 mt-1">{error.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by entity code, SKU, or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full pl-10 pr-4 py-2 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-4 py-2 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {job && job.failed_rows > 0 && (
              <button
                onClick={() => setShowOnlyFailed(!showOnlyFailed)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  showOnlyFailed
                    ? "bg-red-100 border-red-300 text-red-700 font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                {showOnlyFailed ? (
                  <>Show All ({pagination.total})</>
                ) : (
                  <>Show Failed Only ({job.failed_rows})</>
                )}
              </button>
            )}
            <div className="text-sm text-muted-foreground">
              {showOnlyFailed ? (
                <>Showing all {job?.failed_rows || 0} failed items</>
              ) : (
                <>Showing {products.length} of {pagination.total} items (page {pagination.page} of {pagination.totalPages})</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                setPagination((p) => ({ ...p, limit: parseInt(e.target.value), page: 1 }));
              }}
              className="px-2 py-1 text-sm rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Imported Items List */}
      <div className="space-y-3">
        {showOnlyFailed && job?.import_errors ? (
          // Show only failed items
          job.import_errors.length === 0 ? (
            <div className="rounded-lg bg-card p-12 shadow-sm text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No failed items</h3>
              <p className="text-sm text-muted-foreground">All items imported successfully!</p>
            </div>
          ) : (
            job.import_errors.map((error, idx) => {
              const itemId = `error-${idx}`;
              const isExpanded = expandedItems.has(itemId);
              return (
                <div
                  key={itemId}
                  className="rounded-lg bg-card shadow-sm border-2 border-red-300 bg-red-50/50"
                >
                  <button
                    onClick={() => toggleItemExpansion(itemId)}
                    className="w-full p-4 flex items-start gap-4 hover:bg-red-100/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-red-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-red-600" />
                      )}
                    </div>

                    <XCircle className="w-12 h-12 text-red-600 flex-shrink-0" />

                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-red-900 truncate">
                            Row {error.row} - Import Failed
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-red-700 mt-1">
                            <span>Entity: {error.entity_code || 'N/A'}</span>
                          </div>
                          <p className="text-sm text-red-700 mt-2 font-medium">
                            {error.error}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-200 text-red-800 whitespace-nowrap">
                          FAILED
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-red-200">
                      <div className="mt-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-red-900">Error Details</h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Row Number:</span>
                              <div className="font-medium">{error.row}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Entity Code:</span>
                              <div className="font-medium">{error.entity_code || 'Not available'}</div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className="text-muted-foreground text-sm">Error Message:</span>
                            <div className="mt-1 p-3 bg-red-100 rounded border border-red-200 text-sm text-red-800">
                              {error.error}
                            </div>
                          </div>
                        </div>

                        {/* Raw Data Section */}
                        {error.raw_data && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-red-900">Data Sent from API</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {Object.entries(error.raw_data).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key}:</span>
                                  <div className="font-medium break-all">
                                    {value === null || value === undefined || value === ''
                                      ? <span className="text-red-600 italic">empty/missing</span>
                                      : typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)
                                    }
                                  </div>
                                </div>
                              ))}
                            </div>
                            <details className="mt-3">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View raw JSON
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-300 max-h-64 overflow-auto">
                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                  {JSON.stringify(error.raw_data, null, 2)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : products.length === 0 ? (
          <div className="rounded-lg bg-card p-12 shadow-sm text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter
                ? "Try adjusting your search or filters"
                : "No items were imported for this job"}
            </p>
          </div>
        ) : (
          products.map((product) => {
            const isExpanded = expandedItems.has(product._id);
            return (
              <div
                key={product._id}
                className="rounded-lg bg-card shadow-sm border border-border"
              >
                {/* Item Header */}
                <button
                  onClick={() => toggleItemExpansion(product._id)}
                  className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Product Image */}
                  {product.image?.thumbnail && (
                    <img
                      src={product.image.thumbnail}
                      alt={product.name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  )}

                  {/* Product Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {product.name || product.entity_code}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>Entity: {product.entity_code}</span>
                          {product.sku && (
                            <>
                              <span>•</span>
                              <span>SKU: {product.sku}</span>
                            </>
                          )}
                          {product.completeness_score !== undefined && (
                            <>
                              <span>•</span>
                              <span>Completeness: {product.completeness_score}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(
                          product.status
                        )}`}
                      >
                        {product.status}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="mt-4 space-y-4">
                      {/* Basic Info */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Basic Information</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Entity Code:</span>
                            <div className="font-medium">{product.entity_code}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SKU:</span>
                            <div className="font-medium">{product.sku || "—"}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Name:</span>
                            <div className="font-medium">{product.name || "—"}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantity:</span>
                            <div className="font-medium">{product.quantity || "—"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {product.long_description && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">
                            {product.long_description}
                          </p>
                        </div>
                      )}

                      {/* Import Metadata */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Import Details</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {product.source && (
                            <>
                              <div>
                                <span className="text-muted-foreground">Source ID:</span>
                                <div className="font-medium">{product.source.source_id}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Import Date:</span>
                                <div className="font-medium">
                                  {formatDate(product.source.import_date)}
                                </div>
                              </div>
                            </>
                          )}
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <div className="font-medium">{formatDate(product.created_at)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Updated:</span>
                            <div className="font-medium">{formatDate(product.updated_at)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Raw Data */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Raw Data (JSON)</h4>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                          {JSON.stringify(product, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-4 py-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-4 py-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
