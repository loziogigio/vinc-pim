"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Loader2, Search } from "lucide-react";
import type { GapDetailRow, GapType, Pagination } from "./types";

interface Props {
  channel: string;
  busy: boolean;
  onReindexAll: (channel: string) => void;
  onRemoveAllStale: (channel: string) => void;
  onReindexOne: (entityCode: string) => void;
  reloadKey: number;
}

function localizedName(name: GapDetailRow["name"]): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name.it || name.en || Object.values(name)[0] || "";
}

export function GapDetailPanel({ channel, busy, onReindexAll, onRemoveAllStale, onReindexOne, reloadKey }: Props) {
  const { t } = useTranslation();
  const [type, setType] = useState<GapType>("missing");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GapDetailRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ channel, type, page: String(page), limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/b2b/pim/products/batch-sync/scan/detail?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setPagination(data.pagination ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [channel, type, page, q]);

  useEffect(() => { setPage(1); }, [channel, type]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const tabBtn = (value: GapType, label: string) => (
    <button
      onClick={() => setType(value)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        type === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-1">
          {tabBtn("missing", t("pages.pim.batchSync.missingTab"))}
          {tabBtn("stale", t("pages.pim.batchSync.staleTab"))}
          <span className="ml-2 text-xs text-muted-foreground">{channel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
              placeholder={t("common.search")}
              className="w-40 rounded border border-border bg-background py-1.5 pl-7 pr-2 text-sm placeholder:text-muted-foreground"
            />
          </div>
          {type === "missing" ? (
            <button
              onClick={() => onReindexAll(channel)}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t("pages.pim.batchSync.reindexAllMissing")}
            </button>
          ) : (
            <button
              onClick={() => onRemoveAllStale(channel)}
              disabled={busy}
              className="rounded-md border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
            >
              {t("pages.pim.batchSync.removeAllStale")}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t("pages.pim.batchSync.noGap")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Entity code</th>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2 font-medium">{t("pages.pim.batchSync.importedBy")}</th>
                <th className="px-4 py-2 font-medium">{t("pages.pim.batchSync.lastSynced")}</th>
                {type === "missing" && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.entity_code} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-foreground">{row.entity_code}</td>
                  <td className="px-4 py-2 text-foreground">{localizedName(row.name)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.status ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.source_job_id ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {row.solr_indexed_at ? new Date(row.solr_indexed_at).toLocaleString() : t("pages.pim.batchSync.never")}
                  </td>
                  {type === "missing" && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => onReindexOne(row.entity_code)}
                        disabled={busy}
                        className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {t("pages.pim.batchSync.resync")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>{pagination.total.toLocaleString()} total</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">‹</button>
            <span>{page} / {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
