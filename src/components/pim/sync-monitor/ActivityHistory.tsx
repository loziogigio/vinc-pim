"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { Clock, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface HistoryItem {
  _id: string;
  job_id: string;
  status: "running" | "completed" | "failed";
  params: {
    cleanup_mode: string;
    resync_min_score?: number;
  };
  cleanup_result?: { mode: string; removed_count?: number };
  resync_result?: {
    total: number;
    indexed: number;
    failed: number;
    score_updates: number;
  };
  started_by: string;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    completed: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
    failed: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
    running: { icon: Loader2, color: "text-blue-600 dark:text-blue-400" },
  };

  const { icon: Icon, color } = config[status] ?? config.running;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium capitalize ${color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

interface ActivityHistoryProps {
  items: HistoryItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function ActivityHistory({ items, loading, onRefresh }: ActivityHistoryProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-[0.428rem] border border-border bg-card p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t("pages.pim.batchSync.activityHistory")}
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t("common.refresh")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {t("pages.pim.batchSync.noRunsYet")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 font-medium">{t("common.date")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.startedBy")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.cleanup")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.removed")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.indexed")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.historyFailed")}</th>
                <th className="pb-2 font-medium">{t("pages.pim.batchSync.historyDuration")}</th>
                <th className="pb-2 font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-b border-border last:border-0">
                  <td className="py-2.5 text-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{item.started_by}</td>
                  <td className="py-2.5 text-muted-foreground capitalize">
                    {item.params.cleanup_mode.replace("_", " ")}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {item.cleanup_result?.removed_count === -1
                      ? "All"
                      : item.cleanup_result?.removed_count ?? "-"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {item.resync_result?.indexed ?? "-"}
                  </td>
                  <td className="py-2.5">
                    {item.resync_result?.failed ? (
                      <span className="text-red-600 dark:text-red-400">{item.resync_result.failed}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {item.duration_ms
                      ? `${(item.duration_ms / 1000).toFixed(1)}s`
                      : "-"}
                  </td>
                  <td className="py-2.5">
                    <JobStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
