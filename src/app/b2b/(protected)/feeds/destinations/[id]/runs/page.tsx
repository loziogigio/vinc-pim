"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/components/ui/utils";

interface RunRow {
  run_id: string; mode: string; status: string;
  scanned: number; pushed: number; skipped: number; failed: number; deleted: number;
  started_at: string; finished_at?: string; error_summary?: string;
}
interface ItemRow {
  entity_code: string; remote_status: string; last_error?: string; updated_at: string;
}

export default function FeedRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [errors, setErrors] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, itemsRes] = await Promise.all([
        fetch(`/api/b2b/feeds/destinations/${id}/runs?limit=20`),
        fetch(`/api/b2b/feeds/destinations/${id}/items?status=error&limit=50`),
      ]);

      if (!runsRes.ok || !itemsRes.ok) {
        throw new Error(`HTTP ${!runsRes.ok ? runsRes.status : itemsRes.status}`);
      }

      const runsJson = await runsRes.json();
      const itemsJson = await itemsRes.json();

      if (!runsJson.success || !itemsJson.success) {
        throw new Error(runsJson.error || itemsJson.error || "Failed to load data");
      }

      setRuns(runsJson.data?.items ?? []);
      setErrors(itemsJson.data?.items ?? []);
      setError(null);
    } catch (err) {
      console.error("Error loading feed runs:", err);
      setRuns([]);
      setErrors([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const badge = (s: string) => (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded",
        s === "success"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : s === "partial"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : s === "running"
              ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      )}
    >
      {s}
    </span>
  );

  return (
    <div className="p-6">
      <Breadcrumbs
        items={[
          { label: t("pages.feeds.title"), href: "/b2b/feeds" },
          { label: t("pages.feeds.runs") },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("pages.feeds.runs")}</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {t("pages.feeds.loadError")}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-all">{error}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Run</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Scanned</th>
                  <th className="py-2 pr-3">Pushed</th>
                  <th className="py-2 pr-3">Skipped</th>
                  <th className="py-2 pr-3">Failed</th>
                  <th className="py-2 pr-3">Deleted</th>
                  <th className="py-2 pr-3">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.run_id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{r.run_id}</td>
                    <td className="py-2 pr-3">{r.mode}</td>
                    <td className="py-2 pr-3">{badge(r.status)}</td>
                    <td className="py-2 pr-3">{r.scanned}</td>
                    <td className="py-2 pr-3">{r.pushed}</td>
                    <td className="py-2 pr-3">{r.skipped}</td>
                    <td className="py-2 pr-3">{r.failed}</td>
                    <td className="py-2 pr-3">{r.deleted}</td>
                    <td className="py-2 pr-3">{new Date(r.started_at).toLocaleString()}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={9} className="py-3 text-muted-foreground">—</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold text-foreground mb-3">{t("pages.feeds.itemErrors")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Error</th>
                  <th className="py-2 pr-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.entity_code} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{e.entity_code}</td>
                    <td className="py-2 pr-3 text-red-600 dark:text-red-400">{e.last_error}</td>
                    <td className="py-2 pr-3">{new Date(e.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
                {errors.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-muted-foreground">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
