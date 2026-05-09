"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Box,
  BookOpen,
  ChevronDown,
  Database,
  FileText,
  ListTree,
  Loader2,
  MessageSquare,
  Play,
  ScrollText,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ActivitySectionName,
  ActivitySectionPage,
  ActivitySeverity,
} from "@/lib/types/order-activity";
import { ActivityEventCard } from "./ActivityEventCard";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ActivitySectionProps {
  name: ActivitySectionName;
  page: ActivitySectionPage;
  onLoadMore: () => void | Promise<void>;
  isLoadingMore: boolean;
  /** When true, the section is expanded by default on first render. */
  defaultOpen?: boolean;
}

const SECTION_ICONS: Record<ActivitySectionName, LucideIcon> = {
  lifecycle: ScrollText,
  jobs: Play,
  erp: Database,
  payments: Banknote,
  quotations: MessageSquare,
  discounts: Tag,
  items: Box,
  documents: FileText,
  bookings: BookOpen,
  forms: ListTree,
  processingErrors: AlertCircle,
};

function worstSeverity(
  severities: ActivitySeverity[],
): ActivitySeverity {
  if (severities.includes("error")) return "error";
  if (severities.includes("warning")) return "warning";
  if (severities.includes("success")) return "success";
  return "info";
}

function severityBadge(severity: ActivitySeverity): string {
  switch (severity) {
    case "error":
      return "bg-red-100 text-red-700";
    case "warning":
      return "bg-amber-100 text-amber-700";
    case "success":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

export function ActivitySection({
  name,
  page,
  onLoadMore,
  isLoadingMore,
  defaultOpen = false,
}: ActivitySectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const Icon = SECTION_ICONS[name];
  const count = page.totalCount;
  const latestAt = page.events[0]?.at;
  const latest = useMemo(() => {
    if (!latestAt) return null;
    const d = new Date(latestAt);
    return isNaN(d.getTime()) ? null : d;
  }, [latestAt]);

  const severity = useMemo(
    () => worstSeverity(page.events.map((e) => e.severity)),
    [page.events],
  );

  const showBadge =
    severity === "error" || severity === "warning" || count > 0;

  if (count === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/50">
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="font-medium">
            {t(`pages.store.orderActivity.sections.${name}`)}
          </span>
          <span className="ml-auto text-xs">0</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm text-foreground">
          {t(`pages.store.orderActivity.sections.${name}`)}
        </span>
        {showBadge && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${severityBadge(
              severity,
            )}`}
          >
            {count}
          </span>
        )}
        {latest && (
          <span
            className="ml-auto text-xs text-muted-foreground"
            title={latest.toLocaleString()}
          >
            {latest.toLocaleDateString()}{" "}
            {latest.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3 space-y-2">
          <div className="relative space-y-2">
            {/* Timeline rail */}
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
            {page.events.map((event) => (
              <ActivityEventCard key={event.id} event={event} />
            ))}
          </div>
          {page.nextCursor && (
            <button
              type="button"
              onClick={() => onLoadMore()}
              disabled={isLoadingMore}
              className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("pages.store.orderActivity.loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
