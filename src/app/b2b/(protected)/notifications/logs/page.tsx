"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  Mail,
  Check,
  X,
  AlertCircle,
  Eye,
  Calendar,
  Clock,
  MousePointer,
  Send,
  User,
  FileText,
  Play,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

interface EmailLog {
  _id: string;
  email_id: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from: string;
  from_name?: string;
  reply_to?: string;
  subject: string;
  html?: string;
  text?: string;
  template_id?: string;
  status: "queued" | "sending" | "sent" | "failed" | "bounced";
  error?: string;
  message_id?: string;
  tracking_enabled: boolean;
  opens: { opened_at: string; ip?: string; user_agent?: string }[];
  clicks: { url: string; clicked_at: string; ip?: string; user_agent?: string }[];
  open_count: number;
  click_count: number;
  first_opened_at?: string;
  last_opened_at?: string;
  sent_at?: string;
  tags?: string[];
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

interface LogsResponse {
  logs: EmailLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type TimeFilter = "all" | "today" | "yesterday" | "7days" | "30days" | "custom";

const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 days" },
  { value: "30days", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

function getDateRange(filter: TimeFilter): { dateFrom: string; dateTo: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filter) {
    case "today":
      return {
        dateFrom: today.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        dateFrom: yesterday.toISOString().split("T")[0],
        dateTo: yesterday.toISOString().split("T")[0],
      };
    }
    case "7days": {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        dateFrom: weekAgo.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      };
    }
    case "30days": {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        dateFrom: monthAgo.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
      };
    }
    default:
      return null;
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const handleSendNow = async (emailId: string) => {
    setSendingIds((prev) => new Set(prev).add(emailId));
    try {
      const res = await fetch(`/api/b2b/notifications/logs/${emailId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }
      // Reload logs to show updated status
      await loadLogs();
    } catch (error) {
      console.error("Error sending email:", error);
      alert(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  };

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      // Handle date filtering
      if (timeFilter === "custom") {
        if (customDateFrom) params.set("dateFrom", customDateFrom);
        if (customDateTo) params.set("dateTo", customDateTo);
      } else if (timeFilter !== "all") {
        const range = getDateRange(timeFilter);
        if (range) {
          params.set("dateFrom", range.dateFrom);
          params.set("dateTo", range.dateTo);
        }
      }

      const res = await fetch(`/api/b2b/notifications/logs?${params}`);
      if (!res.ok) throw new Error("Failed to load logs");

      const data: LogsResponse = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, timeFilter, customDateFrom, customDateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRecipients = (to: string | string[]) => {
    if (Array.isArray(to)) {
      return to.length === 1 ? to[0] : `${to[0]} +${to.length - 1}`;
    }
    return to;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Notification Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          View history of all sent notifications
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or subject..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
          <option value="sending">Sending</option>
          <option value="bounced">Bounced</option>
        </select>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {TIME_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {timeFilter === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No logs found</p>
            <p className="text-sm text-slate-400 mt-1">
              Sent notifications will appear here
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Opened
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {formatRecipients(log.to)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700 truncate max-w-xs">
                      {log.subject}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.open_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Eye className="w-3 h-3" />
                        {log.open_count}x
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(log.status === "queued" || log.status === "failed") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-primary hover:text-primary"
                          onClick={() => handleSendNow(log.email_id)}
                          disabled={sendingIds.has(log.email_id)}
                        >
                          {sendingIds.has(log.email_id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          Send
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} logs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onSendNow={handleSendNow}
          isSending={sendingIds.has(selectedLog.email_id)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    sent: { icon: Check, className: "bg-emerald-100 text-emerald-700" },
    failed: { icon: AlertCircle, className: "bg-rose-100 text-rose-700" },
    queued: { icon: Clock, className: "bg-slate-100 text-slate-700" },
    sending: { icon: Loader2, className: "bg-blue-100 text-blue-700" },
    bounced: { icon: X, className: "bg-orange-100 text-orange-700" },
  }[status] || { icon: Mail, className: "bg-slate-100 text-slate-700" };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        config.className
      )}
    >
      <Icon className={cn("w-3 h-3", status === "sending" && "animate-spin")} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface LogDetailModalProps {
  log: EmailLog;
  onClose: () => void;
  onSendNow: (emailId: string) => Promise<void>;
  isSending: boolean;
}

function LogDetailModal({ log, onClose, onSendNow, isSending }: LogDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "content" | "tracking">("details");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRecipients = (recipients: string | string[] | undefined) => {
    if (!recipients) return "-";
    if (Array.isArray(recipients)) return recipients.join(", ");
    return recipients;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Email Log Details</h2>
              <p className="text-sm text-slate-500">{log.email_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("details")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors",
              activeTab === "details"
                ? "text-primary border-b-2 border-primary"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("content")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors",
              activeTab === "content"
                ? "text-primary border-b-2 border-primary"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors",
              activeTab === "tracking"
                ? "text-primary border-b-2 border-primary"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Tracking
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg",
                  log.status === "sent" && "bg-emerald-50 border border-emerald-200",
                  log.status === "failed" && "bg-rose-50 border border-rose-200",
                  log.status === "bounced" && "bg-orange-50 border border-orange-200",
                  log.status === "queued" && "bg-slate-50 border border-slate-200",
                  log.status === "sending" && "bg-blue-50 border border-blue-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={log.status} />
                  <div className="text-sm">
                    {log.status === "sent" && log.sent_at && (
                      <span className="text-emerald-700">Sent on {formatDate(log.sent_at)}</span>
                    )}
                    {log.status === "failed" && log.error && (
                      <span className="text-rose-700">{log.error}</span>
                    )}
                    {log.status === "queued" && (
                      <span className="text-slate-700">Waiting to be sent</span>
                    )}
                    {log.status === "sending" && (
                      <span className="text-blue-700">Currently being sent...</span>
                    )}
                    {log.status === "bounced" && (
                      <span className="text-orange-700">Email bounced back</span>
                    )}
                  </div>
                </div>
                {(log.status === "queued" || log.status === "failed") && (
                  <Button
                    size="sm"
                    onClick={() => onSendNow(log.email_id)}
                    disabled={isSending}
                    className="gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Send Now
                  </Button>
                )}
              </div>

              {/* Email Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <DetailItem
                  icon={User}
                  label="From"
                  value={log.from_name ? `${log.from_name} <${log.from}>` : log.from}
                />
                <DetailItem
                  icon={Send}
                  label="To"
                  value={formatRecipients(log.to)}
                />
                {log.cc && (
                  <DetailItem label="CC" value={formatRecipients(log.cc)} />
                )}
                {log.bcc && (
                  <DetailItem label="BCC" value={formatRecipients(log.bcc)} />
                )}
                {log.reply_to && (
                  <DetailItem label="Reply-To" value={log.reply_to} />
                )}
                <DetailItem
                  icon={FileText}
                  label="Subject"
                  value={log.subject}
                  className="col-span-2"
                />
              </div>

              {/* Metadata */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Created:</span>{" "}
                    <span className="text-slate-700">{formatDate(log.created_at)}</span>
                  </div>
                  {log.sent_at && (
                    <div>
                      <span className="text-slate-500">Sent:</span>{" "}
                      <span className="text-slate-700">{formatDate(log.sent_at)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Attempts:</span>{" "}
                    <span className={cn(
                      "text-slate-700",
                      log.attempts >= log.max_attempts && "text-rose-600 font-medium"
                    )}>
                      {log.attempts || 0} / {log.max_attempts || 3}
                    </span>
                  </div>
                  {log.template_id && (
                    <div>
                      <span className="text-slate-500">Template:</span>{" "}
                      <span className="text-slate-700 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {log.template_id}
                      </span>
                    </div>
                  )}
                  {log.message_id && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Message ID:</span>{" "}
                      <span className="text-slate-700 font-mono text-xs">{log.message_id}</span>
                    </div>
                  )}
                  {log.tags && log.tags.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Tags:</span>{" "}
                      <span className="inline-flex gap-1 ml-2">
                        {log.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "content" && (
            <div className="space-y-4">
              {log.html ? (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">HTML Content</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={log.html}
                      title="Email preview"
                      className="w-full h-[500px] bg-white"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : log.text ? (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Text Content</h3>
                  <pre className="p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                    {log.text}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No content available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "tracking" && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Opens</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{log.open_count}</p>
                  {log.first_opened_at && (
                    <p className="text-xs text-emerald-600 mt-1">
                      First: {formatDate(log.first_opened_at)}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <MousePointer className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Clicks</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{log.click_count}</p>
                </div>
              </div>

              {/* Opens List */}
              {log.opens.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Open Events</h3>
                  <div className="space-y-2">
                    {log.opens.map((open, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-emerald-500" />
                          <span className="text-slate-700">{formatDate(open.opened_at)}</span>
                        </div>
                        <div className="text-slate-500 text-xs">
                          {open.ip && <span className="mr-3">IP: {open.ip}</span>}
                          {open.user_agent && (
                            <span className="truncate max-w-[200px] inline-block align-bottom">
                              {open.user_agent}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clicks List */}
              {log.clicks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Click Events</h3>
                  <div className="space-y-2">
                    {log.clicks.map((click, index) => (
                      <div
                        key={index}
                        className="p-3 bg-slate-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <MousePointer className="w-4 h-4 text-blue-500" />
                          <span className="text-slate-700">{formatDate(click.clicked_at)}</span>
                        </div>
                        <p className="text-xs text-blue-600 truncate ml-6">{click.url}</p>
                        {(click.ip || click.user_agent) && (
                          <p className="text-xs text-slate-500 mt-1 ml-6">
                            {click.ip && <span className="mr-3">IP: {click.ip}</span>}
                            {click.user_agent && <span>{click.user_agent}</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.opens.length === 0 && log.clicks.length === 0 && (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No tracking data yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {log.tracking_enabled
                      ? "Opens and clicks will appear here once the email is opened"
                      : "Tracking is disabled for this email"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailItemProps {
  icon?: React.ElementType;
  label: string;
  value: string;
  className?: string;
}

function DetailItem({ icon: Icon, label, value, className }: DetailItemProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <p className="text-sm text-slate-900">{value}</p>
    </div>
  );
}
