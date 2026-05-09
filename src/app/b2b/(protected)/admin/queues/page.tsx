"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Activity, ChevronRight } from "lucide-react";

interface StateCount {
  count: number;
  capped: boolean;
}

interface QueueOverview {
  id: string;
  label: string;
  counts: {
    waiting: StateCount;
    active: StateCount;
    completed: StateCount;
    failed: StateCount;
    delayed: StateCount;
  };
}

const REFRESH_MS = 5000;

export default function QueuesOverviewPage() {
  const [queues, setQueues] = useState<QueueOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/b2b/admin/queues");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQueues(data.queues || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load queues");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const totalActive = queues.reduce((s, q) => s + q.counts.active.count, 0);
  const totalWaiting = queues.reduce((s, q) => s + q.counts.waiting.count, 0);
  const totalFailed = queues.reduce((s, q) => s + q.counts.failed.count, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sync & Job Queues</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tenant-scoped view of background jobs (sync, imports, notifications, payments).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto-refresh ({REFRESH_MS / 1000}s)
          </label>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SummaryCard label="Active now" value={totalActive} color="bg-emerald-500" />
            <SummaryCard label="Waiting" value={totalWaiting} color="bg-amber-500" />
            <SummaryCard label="Failed" value={totalFailed} color="bg-rose-500" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Queue</th>
                  <th className="px-3 py-3 text-right">Waiting</th>
                  <th className="px-3 py-3 text-right">Active</th>
                  <th className="px-3 py-3 text-right">Delayed</th>
                  <th className="px-3 py-3 text-right">Completed</th>
                  <th className="px-3 py-3 text-right">Failed</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {queues.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900">{q.label}</div>
                          <div className="text-xs text-slate-500">{q.id}</div>
                        </div>
                      </div>
                    </td>
                    <CountCell sc={q.counts.waiting} colorClass="text-amber-700" />
                    <CountCell sc={q.counts.active} colorClass="text-emerald-700" />
                    <CountCell sc={q.counts.delayed} colorClass="text-slate-600" />
                    <CountCell sc={q.counts.completed} colorClass="text-slate-600" />
                    <CountCell sc={q.counts.failed} colorClass="text-rose-700" />
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/b2b/admin/queues/detail?queue=${encodeURIComponent(q.id)}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        Open
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Counts are scoped to your tenant via <code>job.data.tenant_id</code>. Limited to the
            most recent 200 jobs per state.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function CountCell({ sc, colorClass }: { sc: StateCount; colorClass: string }) {
  return (
    <td
      className={`px-3 py-3 text-right tabular-nums ${
        sc.count > 0 ? colorClass : "text-slate-400"
      }`}
      title={sc.capped ? "Showing first 1000 most recent jobs in this state" : undefined}
    >
      {sc.count.toLocaleString()}
      {sc.capped && <span className="text-amber-600">+</span>}
    </td>
  );
}
