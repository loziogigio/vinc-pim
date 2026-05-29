"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ChannelGap } from "./types";

interface Props {
  channels: ChannelGap[];
  totals: ChannelGap;
  activeChannel: string | null;
  onSelect: (channel: string) => void;
}

export function ChannelOverviewTable({ channels, totals, activeChannel, onSelect }: Props) {
  const { t } = useTranslation();

  function statusCell(row: ChannelGap) {
    if (row.in_sync) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> {t("pages.pim.batchSync.statusInSync")}
        </span>
      );
    }
    const parts: string[] = [];
    if (row.missing > 0) parts.push(t("pages.pim.batchSync.statusMissing", { count: row.missing }));
    if (row.stale > 0) parts.push(t("pages.pim.batchSync.statusStale", { count: row.stale }));
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> {parts.join(" · ")}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">{t("pages.pim.batchSync.channel")}</th>
            <th className="px-4 py-3 font-medium text-right">{t("pages.pim.batchSync.publishedSearchable")}</th>
            <th className="px-4 py-3 font-medium text-right">{t("pages.pim.batchSync.inIndex")}</th>
            <th className="px-4 py-3 font-medium text-right">{t("pages.pim.batchSync.missing")}</th>
            <th className="px-4 py-3 font-medium text-right">{t("pages.pim.batchSync.stale")}</th>
            <th className="px-4 py-3 font-medium">{t("common.status")}</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((row) => (
            <tr
              key={row.channel}
              onClick={() => onSelect(row.channel)}
              className={`cursor-pointer border-b border-border transition last:border-0 hover:bg-muted/50 ${
                activeChannel === row.channel ? "bg-muted" : ""
              }`}
            >
              <td className="px-4 py-2.5 font-medium text-foreground">{row.channel}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{row.published.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{row.indexed.toLocaleString()}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${row.missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{row.missing.toLocaleString()}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${row.stale > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{row.stale.toLocaleString()}</td>
              <td className="px-4 py-2.5">{statusCell(row)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-4 py-2.5 text-foreground">{t("pages.pim.batchSync.total")}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{totals.published.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{totals.indexed.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{totals.missing.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{totals.stale.toLocaleString()}</td>
            <td className="px-4 py-2.5" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
