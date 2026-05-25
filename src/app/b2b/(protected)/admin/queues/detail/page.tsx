"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";

const STATES = ["waiting", "active", "delayed", "completed", "failed"] as const;
type State = (typeof STATES)[number];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const QUICK_RANGES = [
  { id: "1h", label: "Last hour", ms: 60 * 60 * 1000 },
  { id: "24h", label: "Last 24h", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
] as const;
type QuickRangeId = (typeof QUICK_RANGES)[number]["id"];

interface JobSummary {
  id: string;
  name: string;
  state: State;
  attempts: number;
  progress: number | object;
  data: any;
  returnvalue: any;
  failedReason?: string;
  stacktrace?: string[];
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

const REFRESH_MS = 5000;

const STATE_META: Record<State, { label: string; icon: any; color: string }> = {
  waiting: { label: "Waiting", icon: Clock, color: "text-amber-600" },
  active: { label: "Active", icon: PlayCircle, color: "text-emerald-600" },
  delayed: { label: "Delayed", icon: Pause, color: "text-muted-foreground" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-muted-foreground" },
  failed: { label: "Failed", icon: AlertTriangle, color: "text-rose-600" },
};

export default function QueueDetailPage() {
  const searchParams = useSearchParams();
  const queueId = searchParams.get("queue") || "";

  const [state, setState] = useState<State>("active");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [scanned, setScanned] = useState(0);
  const [scanCap, setScanCap] = useState(0);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState<JobSummary | null>(null);

  // Time filter: either a quick preset (relative to "now") OR a custom from/to range.
  const [quickRange, setQuickRange] = useState<QuickRangeId | null>(null);
  const [customFrom, setCustomFrom] = useState<string>(""); // datetime-local value
  const [customTo, setCustomTo] = useState<string>("");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const qs = new URLSearchParams({
          queue: queueId,
          state,
          page: String(page),
          pageSize: String(pageSize),
        });
        const fromMs = computeFromMs(quickRange, customFrom);
        const toMs = computeToMs(quickRange, customTo);
        if (fromMs !== null) qs.set("from", String(fromMs));
        if (toMs !== null) qs.set("to", String(toMs));

        const res = await fetch(`/api/b2b/admin/queues/jobs?${qs.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setScanned(data.scanned || 0);
        setScanCap(data.scanCap || 0);
        setCapped(Boolean(data.capped));
        if (data.page && data.page !== page) setPage(data.page);
        setError(null);
      } catch (e: any) {
        setError(e.message || "Failed to load jobs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queueId, state, page, pageSize, quickRange, customFrom, customTo]
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  function changeState(next: State) {
    setState(next);
    setPage(1);
    setSelected(null);
  }

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  function applyQuickRange(id: QuickRangeId | null) {
    setQuickRange(id);
    setCustomFrom("");
    setCustomTo("");
    setPage(1);
  }

  function applyCustomFrom(v: string) {
    setQuickRange(null);
    setCustomFrom(v);
    setPage(1);
  }

  function applyCustomTo(v: string) {
    setQuickRange(null);
    setCustomTo(v);
    setPage(1);
  }

  function clearTimeFilter() {
    setQuickRange(null);
    setCustomFrom("");
    setCustomTo("");
    setPage(1);
  }

  const hasTimeFilter = quickRange !== null || customFrom !== "" || customTo !== "";

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link
          href="/b2b/admin/queues"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to queues
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{queueId}</h1>
          <p className="text-sm text-muted-foreground mt-1">Tenant-scoped jobs in this queue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border hover:bg-muted/50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATES.map((s) => {
          const meta = STATE_META[s];
          const Icon = meta.icon;
          return (
            <button
              key={s}
              onClick={() => changeState(s)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                state === s
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <Icon className={`w-4 h-4 ${state === s ? "text-blue-600 dark:text-blue-400" : meta.color}`} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground mr-1">Time:</span>
          {QUICK_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => applyQuickRange(r.id)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                quickRange === r.id
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="mx-1 text-border">|</span>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            From
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => applyCustomFrom(e.target.value)}
              className="rounded border border-border bg-card px-2 py-1 text-xs focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            To
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => applyCustomTo(e.target.value)}
              className="rounded border border-border bg-card px-2 py-1 text-xs focus:border-primary focus:outline-none"
            />
          </label>
          {hasTimeFilter && (
            <button
              onClick={clearTimeFilter}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border bg-card text-muted-foreground hover:border-border/80"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Filters by the most relevant timestamp on each job (finished &gt; started &gt; created).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      ) : (
        <>
          {capped && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
              Showing the most recent {scanCap.toLocaleString()} {state} jobs in this queue. Older jobs
              for your tenant aren&apos;t included in this view.
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {total === 0 ? (
                <>No {state} jobs for this tenant.</>
              ) : (
                <>
                  Showing <span className="font-medium tabular-nums">{rangeStart}–{rangeEnd}</span> of{" "}
                  <span className="font-medium tabular-nums">{total.toLocaleString()}</span> tenant jobs
                  {scanned > 0 && (
                    <span className="text-muted-foreground/60">
                      {" "}· scanned {scanned.toLocaleString()} most recent
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="pageSize" className="text-muted-foreground">
                Per page
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="rounded border border-border bg-card px-2 py-1 text-sm focus:border-primary focus:outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {jobs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No {state} jobs for this tenant.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-right">Tries</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {jobs.map((j) => {
                        const ts = j.finishedOn || j.processedOn || j.timestamp;
                        return (
                          <tr
                            key={j.id}
                            onClick={() => setSelected(j)}
                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                              selected?.id === j.id ? "bg-blue-50 dark:bg-blue-950/30" : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{j.id}</td>
                            <td className="px-3 py-2 text-foreground">{j.name}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{formatTime(ts)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {j.attempts}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onChange={(p) => setPage(p)}
                  />
                </>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              {selected ? (
                <JobDetail job={selected} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a job to inspect its payload, result, and errors.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function JobDetail({ job }: { job: JobSummary }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-foreground">{job.name}</h3>
        <p className="text-xs text-muted-foreground">
          ID <span className="font-mono">{job.id}</span> · State{" "}
          <span className="font-medium">{job.state}</span> · Attempts {job.attempts}
        </p>
      </div>

      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Row k="Created" v={formatTime(job.timestamp)} />
          <Row k="Started" v={formatTime(job.processedOn)} />
          <Row k="Finished" v={formatTime(job.finishedOn)} />
          <Row
            k="Duration"
            v={
              job.processedOn && job.finishedOn
                ? `${((job.finishedOn - job.processedOn) / 1000).toFixed(2)}s`
                : "—"
            }
          />
        </div>
      </Section>

      <Section title="Data">
        <Pre value={job.data} />
      </Section>

      {job.returnvalue && (
        <Section title="Result">
          <Pre value={job.returnvalue} />
        </Section>
      )}

      {job.failedReason && (
        <Section title="Failure" tone="error">
          <p className="font-mono text-xs whitespace-pre-wrap break-words text-rose-700 dark:text-rose-400">
            {job.failedReason}
          </p>
          {job.stacktrace && job.stacktrace.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-rose-700 dark:text-rose-400">Stacktrace</summary>
              <pre className="mt-1 text-xs text-rose-700 dark:text-rose-400 whitespace-pre-wrap break-words font-mono">
                {job.stacktrace.join("\n")}
              </pre>
            </details>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "error"; children: React.ReactNode }) {
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wider mb-1 ${tone === "error" ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{k}: </span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}

function Pre({ value }: { value: unknown }) {
  return (
    <pre className="bg-muted border border-border rounded p-2 text-xs overflow-auto max-h-80 font-mono text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatTime(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString();
}

function computeFromMs(quick: QuickRangeId | null, custom: string): number | null {
  if (quick) {
    const r = QUICK_RANGES.find((q) => q.id === quick);
    return r ? Date.now() - r.ms : null;
  }
  if (!custom) return null;
  const t = new Date(custom).getTime();
  return Number.isNaN(t) ? null : t;
}

function computeToMs(quick: QuickRangeId | null, custom: string): number | null {
  if (quick) return Date.now();
  if (!custom) return null;
  const t = new Date(custom).getTime();
  return Number.isNaN(t) ? null : t;
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pageButtons = buildPageList(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-muted px-3 py-2 text-sm">
      <div className="text-xs text-muted-foreground">
        Page <span className="font-medium tabular-nums">{page}</span> of{" "}
        <span className="font-medium tabular-nums">{totalPages}</span>
      </div>
      <div className="flex items-center gap-1">
        <PageBtn disabled={page === 1} onClick={() => onChange(1)} title="First page">
          <ChevronsLeft className="w-4 h-4" />
        </PageBtn>
        <PageBtn
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </PageBtn>
        {pageButtons.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[2rem] px-2 py-1 text-xs rounded border transition-colors ${
                p === page
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
                  : "border-border bg-card text-foreground hover:border-border/80"
              }`}
            >
              {p}
            </button>
          )
        )}
        <PageBtn
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </PageBtn>
        <PageBtn
          disabled={page >= totalPages}
          onClick={() => onChange(totalPages)}
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  disabled,
  onClick,
  title,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-card text-muted-foreground hover:border-border/80 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}
