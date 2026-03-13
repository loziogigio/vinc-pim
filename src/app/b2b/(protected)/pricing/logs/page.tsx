"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PRICING_PROVIDERS, PRICING_PROVIDER_LABELS } from "@/lib/constants/pricing-provider";
import type { PricingProvider } from "@/lib/constants/pricing-provider";
import { PRICING_LOG_STATUSES } from "@/lib/db/models/pricing-request-log";

interface LogEntry {
  log_id: string;
  provider: string;
  entity_codes: string[];
  entity_count: number;
  customer_code: string;
  status: string;
  resolved_count: number;
  error_count: number;
  duration_ms: number;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PricingLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (statusFilter) params.set("status", statusFilter);
        if (providerFilter) params.set("provider", providerFilter);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        const res = await fetch(`/api/b2b/pricing/logs?${params}`);
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data.items);
          setPagination(json.data.pagination);
        }
      } catch (err) {
        console.error("Error loading pricing logs:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, providerFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">
          {t("pages.pricing.logs.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pages.pricing.logs.subtitle")}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              {t("pages.pricing.logs.filterStatus")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
            >
              <option value="">{t("common.all")}</option>
              {PRICING_LOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              {t("pages.pricing.logs.filterProvider")}
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
            >
              <option value="">{t("common.all")}</option>
              {PRICING_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PRICING_PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              {t("pages.pricing.logs.dateFrom")}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              {t("pages.pricing.logs.dateTo")}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ScrollText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>{t("pages.pricing.logs.noLogs")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colDate")}
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colProvider")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colProducts")}
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colCustomer")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colStatus")}
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colDuration")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colResolved")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.logs.colErrors")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.log_id}
                      className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors"
                    >
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-[#5e5873]">
                        {PRICING_PROVIDER_LABELS[
                          log.provider as PricingProvider
                        ] || log.provider}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {log.entity_count}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[#5e5873]">
                        {log.customer_code || "-"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge status={log.status} t={t} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        {log.duration_ms}ms
                      </td>
                      <td className="px-4 py-2 text-center text-green-600 font-medium">
                        {log.resolved_count}
                      </td>
                      <td className="px-4 py-2 text-center text-red-600 font-medium">
                        {log.error_count > 0 ? log.error_count : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#ebe9f1]">
                <p className="text-sm text-muted-foreground">
                  {t("pages.pricing.logs.showing")
                    .replace("{{from}}", String((pagination.page - 1) * pagination.limit + 1))
                    .replace("{{to}}", String(Math.min(pagination.page * pagination.limit, pagination.total)))
                    .replace("{{total}}", String(pagination.total))}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => loadLogs(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-1.5 rounded border border-[#ebe9f1] disabled:opacity-30 hover:bg-[#f8f8f8]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm text-[#5e5873]">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadLogs(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 rounded border border-[#ebe9f1] disabled:opacity-30 hover:bg-[#f8f8f8]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    success: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: t("pages.pricing.logs.statusSuccess"),
    },
    failed: {
      bg: "bg-red-100",
      text: "text-red-700",
      label: t("pages.pricing.logs.statusFailed"),
    },
    timed_out: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      label: t("pages.pricing.logs.statusTimedOut"),
    },
    circuit_open: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      label: t("pages.pricing.logs.statusCircuitOpen"),
    },
  };

  const c = config[status] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
