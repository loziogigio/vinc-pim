"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  FileText,
  RefreshCw,
  RotateCcw,
  Trash2,
  StopCircle,
  Download,
  ExternalLink,
  Database,
  Search,
  Filter,
  X,
} from "lucide-react";

type ImportJob = {
  _id: string;
  job_id: string;
  source_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  file_name: string;
  file_size?: number;
  file_url?: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  auto_published_count: number;
  batch_id?: string;
  batch_part?: number;
  batch_total_parts?: number;
  batch_total_items?: number;
  import_errors: {
    row: number;
    entity_code: string;
    error: string;
  }[];
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
};

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [completedFrom, setCompletedFrom] = useState("");
  const [completedTo, setCompletedTo] = useState("");

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchJobs();

    if (autoRefresh) {
      const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, pagination.page, pagination.limit, statusFilter, sourceFilter, batchFilter, searchQuery, createdFrom, createdTo, completedFrom, completedTo]);

  async function fetchJobs() {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter) params.append("status", statusFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (batchFilter) params.append("batch", batchFilter);
      if (searchQuery) params.append("search", searchQuery);
      if (createdFrom) params.append("created_from", createdFrom);
      if (createdTo) params.append("created_to", createdTo);
      if (completedFrom) params.append("completed_from", completedFrom);
      if (completedTo) params.append("completed_to", completedTo);

      const res = await fetch(`/api/b2b/pim/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || data.jobs?.length || 0,
          totalPages: data.pagination?.totalPages || 1,
        }));

        // Disable auto-refresh if no active jobs
        const hasActiveJobs = data.jobs?.some(
          (job: ImportJob) => job.status === "pending" || job.status === "processing"
        );
        if (!hasActiveJobs && autoRefresh) {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      if (isLoading) setIsLoading(false);
    }
  }

  async function handleJobAction(jobId: string, action: "retry" | "cancel" | "delete") {
    const confirmMessages = {
      retry: "Are you sure you want to retry this job?",
      cancel: "Are you sure you want to cancel this job?",
      delete: "Are you sure you want to delete this job?",
    };

    if (!confirm(confirmMessages[action])) return;

    try {
      const res = await fetch(`/api/b2b/pim/jobs/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || `Job ${action} successful`);
        fetchJobs(); // Refresh the jobs list
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${action} job`);
      }
    } catch (error) {
      console.error(`Error ${action}ing job:`, error);
      alert(`Failed to ${action} job`);
    }
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
        return "bg-emerald-100 text-emerald-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "pending":
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

  function formatFileSize(bytes?: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function handleDownloadFile(fileUrl: string, fileName: string) {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          { label: "Import Jobs" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Track and monitor product import jobs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => fetchJobs()}
            className="flex items-center gap-2 px-4 py-2 rounded border border-border hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by file name, job ID, or source..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
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
            className="px-4 py-2 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Source ID..."
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="pl-10 pr-4 py-2 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Batch ID..."
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="pl-10 pr-4 py-2 rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
              />
            </div>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Created Date Range */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Created Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Completed Date Range */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Completed Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={completedFrom}
                  onChange={(e) => {
                    setCompletedFrom(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={completedTo}
                  onChange={(e) => {
                    setCompletedTo(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="To"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(statusFilter || sourceFilter || batchFilter || searchQuery || createdFrom || createdTo || completedFrom || completedTo) && (
              <button
                onClick={() => {
                  setStatusFilter("");
                  setSourceFilter("");
                  setBatchFilter("");
                  setSearchQuery("");
                  setCreatedFrom("");
                  setCreatedTo("");
                  setCompletedFrom("");
                  setCompletedTo("");
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-border hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            )}
            <div className="text-sm text-muted-foreground">
              {pagination.total > 0 ? (
                <>Showing {jobs.length} of {pagination.total} jobs</>
              ) : (
                <>No jobs found</>
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
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="rounded-lg bg-card p-12 shadow-sm text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No import jobs</h3>
            <p className="text-sm text-muted-foreground">
              Import jobs will appear here once you upload files
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job._id}
              onClick={() => router.push(`/b2b/pim/jobs/${job.job_id}`)}
              className="rounded-lg bg-card p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">{getStatusIcon(job.status)}</div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-foreground">
                          {job.file_name}
                        </h3>
                        {job.file_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(job.file_url!, job.file_name);
                            }}
                            className="p-1 rounded hover:bg-muted text-primary"
                            title="Download original file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Job ID: {job.job_id}</span>
                        {job.batch_id && (
                          <>
                            <span>•</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBatchFilter(job.batch_id!);
                                setPagination((p) => ({ ...p, page: 1 }));
                              }}
                              className="font-mono text-primary hover:underline"
                              title="Click to filter by this batch"
                            >
                              Batch: {job.batch_id}
                              {job.batch_total_parts && job.batch_total_parts > 1 &&
                                ` (${job.batch_part}/${job.batch_total_parts})`}
                            </button>
                          </>
                        )}
                        {job.file_size && (
                          <>
                            <span>•</span>
                            <span>File Size: {formatFileSize(job.file_size)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          Source: {job.source_id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>

                      {/* Action Buttons */}
                      <div className="flex gap-1">
                        {/* Download button - always available if file_url exists */}
                        {job.file_url && (
                          <a
                            href={job.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded border border-border hover:bg-primary/10 hover:border-primary text-primary"
                            title="View file"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}

                        {/* Retry button - only for failed jobs */}
                        {job.status === "failed" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJobAction(job.job_id, "retry");
                            }}
                            className="p-1.5 rounded border border-border hover:bg-blue-50 hover:border-blue-200 text-blue-600"
                            title="Retry job"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Cancel button - only for pending/processing jobs */}
                        {(job.status === "pending" || job.status === "processing") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJobAction(job.job_id, "cancel");
                            }}
                            className="p-1.5 rounded border border-border hover:bg-amber-50 hover:border-amber-200 text-amber-600"
                            title="Cancel job"
                          >
                            <StopCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete button - for completed/failed jobs */}
                        {(job.status === "completed" || job.status === "failed") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJobAction(job.job_id, "delete");
                            }}
                            className="p-1.5 rounded border border-border hover:bg-red-50 hover:border-red-200 text-red-600"
                            title="Delete job"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {job.status === "processing" && job.total_rows > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          Processing: {job.processed_rows} / {job.total_rows} rows
                        </span>
                        <span>
                          {Math.round((job.processed_rows / job.total_rows) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{
                            width: `${(job.processed_rows / job.total_rows) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Rows:</span>
                      <div className="font-medium">{job.total_rows}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Successful:</span>
                      <div className="font-medium text-emerald-600">
                        {job.successful_rows}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>
                      <div className="font-medium text-red-600">{job.failed_rows}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Auto-published:</span>
                      <div className="font-medium text-blue-600">
                        {job.auto_published_count}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <div className="font-medium">
                        {formatDuration(job.duration_seconds)}
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="mt-3 text-xs text-muted-foreground">
                    <span>Started: {formatDate(job.created_at)}</span>
                    {job.completed_at && (
                      <span className="ml-4">
                        Completed: {formatDate(job.completed_at)}
                      </span>
                    )}
                  </div>

                  {/* Errors */}
                  {job.import_errors && job.import_errors.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 mb-2">
                            {job.import_errors.length} errors occurred:
                          </p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {job.import_errors.slice(0, 5).map((error, idx) => (
                              <p key={idx} className="text-xs text-red-700">
                                Row {error.row}
                                {error.entity_code && ` (${error.entity_code})`}: {error.error}
                              </p>
                            ))}
                            {job.import_errors.length > 5 && (
                              <p className="text-xs text-red-700 font-medium">
                                ... and {job.import_errors.length - 5} more errors
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
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
