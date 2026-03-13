"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Activity,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PRICING_PROVIDER_LABELS } from "@/lib/constants/pricing-provider";
import type { PricingProvider } from "@/lib/constants/pricing-provider";

interface PricingStats {
  total_requests: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  avg_duration_ms: number;
  total_resolved: number;
  total_errors: number;
}

interface CircuitState {
  tenant_id: string;
  status: "closed" | "open" | "half_open";
  failure_count: number;
  success_count: number;
  last_failure_at: number;
  opened_at: number;
}

interface RecentLog {
  log_id: string;
  provider: string;
  entity_count: number;
  customer_code: string;
  status: string;
  duration_ms: number;
  resolved_count: number;
  error_count: number;
  created_at: string;
}

interface DashboardData {
  stats: PricingStats;
  circuit_breaker: CircuitState;
  active_provider: string | null;
  recent_logs: RecentLog[];
}

const DEFAULT_STATS: PricingStats = {
  total_requests: 0,
  success_count: 0,
  failed_count: 0,
  success_rate: 0,
  avg_duration_ms: 0,
  total_resolved: 0,
  total_errors: 0,
};

export default function PricingDashboardPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pricing/stats");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      console.error("Error loading pricing dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = data?.stats || DEFAULT_STATS;
  const circuit = data?.circuit_breaker;

  const circuitColor =
    circuit?.status === "closed"
      ? "bg-green-50 text-green-700 border-green-200"
      : circuit?.status === "open"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  const circuitIcon =
    circuit?.status === "closed"
      ? CheckCircle2
      : circuit?.status === "open"
        ? XCircle
        : AlertTriangle;

  const CircuitIcon = circuitIcon;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">
          {t("pages.pricing.dashboard.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pages.pricing.dashboard.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t("pages.pricing.dashboard.totalRequests")}
              value={String(stats.total_requests)}
              icon={BarChart3}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t("pages.pricing.dashboard.successRate")}
              value={`${stats.success_rate}%`}
              icon={TrendingUp}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label={t("pages.pricing.dashboard.avgDuration")}
              value={`${stats.avg_duration_ms}ms`}
              icon={Clock}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              label={t("pages.pricing.dashboard.errors")}
              value={String(stats.failed_count)}
              icon={AlertTriangle}
              color="bg-red-50 text-red-600"
            />
          </div>

          {/* Circuit Breaker + Active Provider */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Circuit Breaker Status */}
            <div
              className={`rounded-lg border p-4 ${circuitColor}`}
            >
              <div className="flex items-center gap-3">
                <CircuitIcon className="w-6 h-6" />
                <div>
                  <p className="font-semibold">
                    {t("pages.pricing.dashboard.circuitBreaker")}
                  </p>
                  <p className="text-sm mt-0.5">
                    {circuit?.status === "closed"
                      ? t("pages.pricing.dashboard.circuitClosed")
                      : circuit?.status === "open"
                        ? t("pages.pricing.dashboard.circuitOpen")
                        : t("pages.pricing.dashboard.circuitHalfOpen")}
                  </p>
                </div>
              </div>
              {circuit && circuit.status !== "closed" && (
                <div className="mt-2 text-xs opacity-80">
                  {t("pages.pricing.dashboard.failures")}: {circuit.failure_count}
                  {circuit.opened_at > 0 && (
                    <span className="ml-3">
                      {t("pages.pricing.dashboard.openedAt")}:{" "}
                      {new Date(circuit.opened_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Active Provider */}
            <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("pages.pricing.dashboard.activeProvider")}
                  </p>
                  <p className="font-semibold text-[#5e5873]">
                    {data?.active_provider
                      ? PRICING_PROVIDER_LABELS[
                          data.active_provider as PricingProvider
                        ] || data.active_provider
                      : t("pages.pricing.dashboard.noProvider")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="bg-white rounded-lg border border-[#ebe9f1]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe9f1]">
              <h2 className="font-medium text-[#5e5873]">
                {t("pages.pricing.dashboard.recentRequests")}
              </h2>
              <Link
                href={`${tenantPrefix}/b2b/pricing/logs`}
                className="text-sm text-[#009688] hover:underline"
              >
                {t("pages.pricing.dashboard.viewAll")}
              </Link>
            </div>
            {!data?.recent_logs?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>{t("pages.pricing.dashboard.noLogs")}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.dashboard.date")}
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.dashboard.provider")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.dashboard.products")}
                    </th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.dashboard.status")}
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-[#5e5873]">
                      {t("pages.pricing.dashboard.duration")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_logs.map((log) => (
                    <tr
                      key={log.log_id}
                      className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors"
                    >
                      <td className="px-4 py-2 text-muted-foreground">
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
                      <td className="px-4 py-2 text-center">
                        <StatusBadge status={log.status} t={t} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        {log.duration_ms}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#5e5873]">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
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
