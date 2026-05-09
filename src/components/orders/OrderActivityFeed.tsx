"use client";

import { useMemo } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useOrderActivity } from "@/lib/hooks/useOrderActivity";
import { ACTIVITY_SECTION_NAMES } from "@/lib/types/order-activity";
import { ActivitySection } from "./ActivitySection";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface OrderActivityFeedProps {
  orderId: string;
  /** When "processing" the feed auto-polls every 10s. */
  processingStatus?: string | null;
  /** When false, the hook stays idle — pass `open` from the modal. */
  enabled: boolean;
}

export function OrderActivityFeed({
  orderId,
  processingStatus,
  enabled,
}: OrderActivityFeedProps) {
  const { t } = useTranslation();
  const {
    sections,
    isLoading,
    isRefreshing,
    error,
    refresh,
    loadMore,
    loadingSection,
    lastFetchedAt,
  } = useOrderActivity({
    orderId,
    pollWhileActive: processingStatus === "processing",
    enabled,
  });

  const lastFetchedLabel = useMemo(() => {
    if (!lastFetchedAt) return null;
    const d = new Date(lastFetchedAt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastFetchedAt]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {processingStatus === "processing" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("pages.store.orderActivity.autoRefreshLabel")}
            </span>
          )}
          {lastFetchedLabel && (
            <span className="ml-2">
              {t("pages.store.orderActivity.lastFetched", {
                time: lastFetchedLabel,
              })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t("pages.store.orderActivity.refresh")}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !sections && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Sections */}
      {sections && (
        <div className="space-y-2">
          {ACTIVITY_SECTION_NAMES.map((name) => (
            <ActivitySection
              key={name}
              name={name}
              page={sections[name]}
              onLoadMore={() => loadMore(name)}
              isLoadingMore={loadingSection === name}
              // Open sections that have content by default, starting with jobs/errors
              // if they have noteworthy severity.
              defaultOpen={
                sections[name].totalCount > 0 &&
                (name === "lifecycle" ||
                  name === "jobs" ||
                  name === "processingErrors" ||
                  sections[name].events.some((e) => e.severity === "error"))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
