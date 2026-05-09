"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Check,
  Circle,
  Copy,
  ExternalLink,
  Info,
  XCircle,
} from "lucide-react";
import type { ActivityBadge, BadgeTone, TimelineEvent } from "@/lib/types/order-activity";
import { ActivityJsonPanel } from "./ActivityJsonPanel";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ActivityEventCardProps {
  event: TimelineEvent;
}

function badgeClass(tone: BadgeTone | undefined): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "failure":
      return "bg-red-100 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "sync":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "async":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "info":
      return "bg-sky-100 text-sky-700 border-sky-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

interface CopyIdBadgeProps {
  id: string;
}

function CopyIdBadge({ id }: CopyIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={id}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
    >
      <span>{truncateId(id)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function renderBadges(badges: ActivityBadge[] | undefined) {
  if (!badges?.length) return null;
  return badges.map((b, i) => (
    <span
      key={`${b.label}-${i}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeClass(
        b.tone,
      )}`}
    >
      {b.label}
    </span>
  ));
}

function severityClass(severity: TimelineEvent["severity"]) {
  switch (severity) {
    case "success":
      return { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
    case "error":
      return { dot: "bg-red-500", badge: "bg-red-100 text-red-700" };
    case "warning":
      return { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" };
    case "info":
    default:
      return { dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700" };
  }
}

function severityIcon(severity: TimelineEvent["severity"]) {
  switch (severity) {
    case "success":
      return CheckCircle2;
    case "error":
      return XCircle;
    case "warning":
      return AlertTriangle;
    case "info":
    default:
      return Info;
  }
}

function formatRelative(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return iso;
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ActivityEventCard({ event }: ActivityEventCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const sev = severityClass(event.severity);
  const Icon = severityIcon(event.severity);
  const hasRequest = event.request !== undefined && event.request !== null;
  const hasResponse = event.response !== undefined && event.response !== null;
  const hasLogs = typeof event.logs === "string" && event.logs.trim().length > 0;
  const hasRaw = event.raw !== undefined && event.raw !== null;
  const canExpand = hasRequest || hasResponse || hasLogs || hasRaw;

  const now = useMemo(() => Date.now(), []);

  return (
    <div className="relative pl-6">
      <div
        className={`absolute left-1.5 top-3 h-2.5 w-2.5 rounded-full ${sev.dot} ring-2 ring-background`}
      />
      <div className="rounded-md border border-border bg-background hover:bg-muted/30 transition-colors">
        <div
          role={canExpand ? "button" : undefined}
          tabIndex={canExpand ? 0 : -1}
          aria-expanded={canExpand ? expanded : undefined}
          aria-disabled={canExpand ? undefined : true}
          className={`flex w-full items-start gap-3 px-3 py-2 text-left ${canExpand ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (canExpand) setExpanded((v) => !v);
          }}
          onKeyDown={(e) => {
            if (!canExpand) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
        >
          <Icon
            className={`h-4 w-4 mt-0.5 shrink-0 ${
              event.severity === "success"
                ? "text-emerald-600"
                : event.severity === "error"
                  ? "text-red-600"
                  : event.severity === "warning"
                    ? "text-amber-600"
                    : "text-sky-600"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground font-mono break-all">
                {event.title}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${sev.badge}`}
              >
                {event.source}
              </span>
              {renderBadges(event.badges)}
              {event.actor && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Circle className="h-2 w-2 fill-current" />
                  {event.actor}
                </span>
              )}
            </div>
            {event.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 break-words font-mono">
                {event.subtitle}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="text-[11px] text-muted-foreground"
              title={formatAbsolute(event.at)}
            >
              {formatRelative(event.at, now)}
            </span>
            <div className="flex items-center gap-1">
              {event.copyId && <CopyIdBadge id={event.copyId} />}
              {event.externalUrl && (
                <a
                  href={event.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors"
                  title={
                    event.externalUrlLabel ||
                    t("pages.store.orderActivity.openInWindmill")
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("pages.store.orderActivity.openInWindmillShort")}
                </a>
              )}
            </div>
            {canExpand && (
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            )}
          </div>
        </div>
        {expanded && canExpand && (
          <div className="border-t border-border px-3 py-2 space-y-2">
            {(hasRequest || hasResponse) && (
              <div className="grid gap-2 md:grid-cols-2">
                {hasRequest && (
                  <ActivityJsonPanel
                    label={t("pages.store.orderActivity.request")}
                    value={event.request}
                    variant="request"
                  />
                )}
                {hasResponse && (
                  <ActivityJsonPanel
                    label={t("pages.store.orderActivity.response")}
                    value={event.response}
                    variant="response"
                  />
                )}
              </div>
            )}
            {hasLogs && (
              <ActivityJsonPanel
                label={t("pages.store.orderActivity.logs")}
                value={event.logs}
                variant="raw"
              />
            )}
            {hasRaw && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
                >
                  {showRaw
                    ? t("pages.store.orderActivity.hideRaw")
                    : t("pages.store.orderActivity.showRaw")}
                </button>
                {showRaw && (
                  <div className="mt-2">
                    <ActivityJsonPanel
                      label={t("pages.store.orderActivity.raw")}
                      value={event.raw}
                      variant="raw"
                    />
                  </div>
                )}
              </div>
            )}
            <p
              className="text-[10px] text-muted-foreground font-mono"
              title={formatAbsolute(event.at)}
            >
              {formatAbsolute(event.at)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
