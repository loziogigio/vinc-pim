"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { ChannelOverviewTable } from "@/components/pim/sync-monitor/ChannelOverviewTable";
import { GapDetailPanel } from "@/components/pim/sync-monitor/GapDetailPanel";
import { AdvancedOps } from "@/components/pim/sync-monitor/AdvancedOps";
import { ActivityHistory, type HistoryItem } from "@/components/pim/sync-monitor/ActivityHistory";
import { FindProduct } from "@/components/pim/sync-monitor/FindProduct";
import type { ScanResponse } from "@/components/pim/sync-monitor/types";

export default function SyncMonitorPage() {
  const { t } = useTranslation();
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync/scan");
      const data = await res.json();
      if (res.ok) {
        setScan(data);
        setActiveChannel((prev) => prev ?? (data.channels.find((c: any) => !c.in_sync)?.channel ?? data.channels[0]?.channel ?? null));
      } else {
        setScan({ success: false, solr_available: data.solr_available ?? false, channels: [], totals: { channel: "TOTAL", published: 0, indexed: 0, missing: 0, stale: 0, in_sync: true } });
      }
    } finally {
      setScanning(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync?limit=10");
      const data = await res.json();
      if (res.ok) setHistory(data.items ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadScan(); loadHistory(); }, [loadScan, loadHistory]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const runAction = useCallback(async (url: string, body: any) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Action failed"); setBusy(false); return; }
      const jobId = data.job_id as string;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const h = await fetch("/api/b2b/pim/products/batch-sync?limit=10").then((r) => r.json()).catch(() => null);
        if (!h?.items) return;
        setHistory(h.items);
        const row = h.items.find((it: HistoryItem) => it.job_id === jobId);
        if (row && row.status !== "running") {
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);
          await loadScan();
          setReloadKey((k) => k + 1);
        }
      }, 3000);
    } catch (e: any) {
      alert(e.message); setBusy(false);
    }
  }, [loadScan]);

  const onReindexAll = (channel: string) => runAction("/api/b2b/pim/products/batch-sync/reindex", { channel });
  const onRemoveAllStale = (channel: string) => runAction("/api/b2b/pim/products/batch-sync/remove-stale", { channel });
  const onReindexOne = (entityCode: string) => runAction("/api/b2b/pim/products/batch-sync/reindex", { entity_codes: [entityCode] });

  const solrDown = scan && !scan.solr_available;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: t("pages.pim.breadcrumbPim"), href: "/b2b/pim" }, { label: t("pages.pim.batchSync.searchIndexMonitor") }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t("pages.pim.batchSync.searchIndexMonitor")}</h1>
          {scan?.scanned_at && (
            <p className="text-xs text-muted-foreground">
              {t("pages.pim.batchSync.lastScan")}: {new Date(scan.scanned_at).toLocaleString()} · {scan.totals.published.toLocaleString()} {t("pages.pim.batchSync.publishedSearchable")} · {scan.totals.indexed.toLocaleString()} {t("pages.pim.batchSync.inIndex")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FindProduct />
          <button
            onClick={loadScan}
            disabled={scanning || !!solrDown}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? t("pages.pim.batchSync.scanning") : t("pages.pim.batchSync.scanNow")}
          </button>
        </div>
      </div>

      {solrDown && (
        <div className="flex items-center gap-2 rounded-[0.428rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" /> {t("pages.pim.batchSync.solrUnavailable")}
        </div>
      )}

      {scan && scan.channels.length > 0 && (
        <>
          <ChannelOverviewTable channels={scan.channels} totals={scan.totals} activeChannel={activeChannel} onSelect={setActiveChannel} />
          {activeChannel && (
            <GapDetailPanel
              channel={activeChannel}
              busy={busy}
              reloadKey={reloadKey}
              onReindexAll={onReindexAll}
              onRemoveAllStale={onRemoveAllStale}
              onReindexOne={onReindexOne}
            />
          )}
        </>
      )}

      <AdvancedOps onChanged={() => { loadScan(); loadHistory(); }} />
      <ActivityHistory items={history} loading={historyLoading} onRefresh={loadHistory} />
    </div>
  );
}
