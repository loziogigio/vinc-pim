"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { IFeedDestination } from "@/lib/db/models/feed-destination";

type DestinationRow = Pick<
  IFeedDestination,
  | "destination_id"
  | "type"
  | "name"
  | "status"
  | "status_message"
  | "channel"
  | "last_run"
>;

// Brand names are proper nouns and are not translated across locales.
const TYPE_LABELS: Record<DestinationRow["type"], string> = {
  google_merchant: "Google Merchant",
  meta_catalog: "Meta Shops",
  trovaprezzi: "TrovaPrezzi",
};

export default function FeedsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DestinationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/b2b/feeds/destinations");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setRows(json.data ?? []);
      setError(null);
    } catch (err) {
      console.error("Error loading feed destinations:", err);
      setRows([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadge = (s: DestinationRow["status"]) => {
    const cls =
      s === "active"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : s === "error"
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          : "bg-muted text-muted-foreground";
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded", cls)}>
        {t(`pages.feeds.status.${s}`)}
      </span>
    );
  };

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: t("pages.feeds.title") }]} />
      <div className="flex items-center justify-between mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.feeds.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.feeds.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href="/b2b/feeds/destinations/new">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              {t("pages.feeds.newDestination")}
            </Button>
          </Link>
        </div>
      </div>

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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <Link
              key={d.destination_id}
              href={`/b2b/feeds/destinations/${d.destination_id}`}
              className="rounded-lg border border-border bg-background p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground">{d.name}</span>
                {statusBadge(d.status)}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {TYPE_LABELS[d.type]} · {d.channel}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("pages.feeds.lastRun")}:{" "}
                {d.last_run?.finished_at
                  ? `${new Date(d.last_run.finished_at).toLocaleString()} — ok ${d.last_run.pushed ?? 0} / ko ${d.last_run.failed ?? 0}`
                  : t("pages.feeds.never")}
              </p>
              {d.status === "error" && d.status_message && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                  {d.status_message}
                </p>
              )}
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              {t("pages.feeds.empty")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
