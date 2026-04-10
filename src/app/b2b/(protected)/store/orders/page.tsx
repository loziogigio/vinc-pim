"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  TrendingUp,
  Package,
  Euro,
  Plus,
  Calendar,
  CalendarDays,
  CalendarRange,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ── Types ──

interface OrderStats {
  draft: number;
  quotation: number;
  pending: number;
  confirmed: number;
  preparing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  total: number;
  totalValue: number;
  valueByStatus: Record<string, number>;
  timePeriods: { today: number; thisWeek: number; thisMonth: number };
  avgOrderValue: number;
  conversion: { totalDrafts: number; submittedOrders: number; conversionRate: number };
  recentOrders: Array<{
    order_id: string;
    status: string;
    order_total: number;
    items_count: number;
    created_at: string;
  }>;
}

interface DashboardFilters {
  datePreset: string;
  dateFrom: string;
  dateTo: string;
  channel: string;
}

const emptyStats: OrderStats = {
  draft: 0, quotation: 0, pending: 0, confirmed: 0, preparing: 0,
  shipped: 0, delivered: 0, cancelled: 0, total: 0, totalValue: 0,
  valueByStatus: { draft: 0, quotation: 0, pending: 0, confirmed: 0, preparing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  timePeriods: { today: 0, thisWeek: 0, thisMonth: 0 },
  avgOrderValue: 0,
  conversion: { totalDrafts: 0, submittedOrders: 0, conversionRate: 0 },
  recentOrders: [],
};

const currencyFormat = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const compactCurrencyFormat = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
  style: "currency",
  currency: "EUR",
});

// ── Date Preset Helpers ──

function getDateRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      return { from: d, to: d };
    }
    case "thisWeek": {
      const ws = new Date(now);
      const dow = ws.getDay();
      ws.setDate(ws.getDate() - (dow === 0 ? 6 : dow - 1));
      return { from: fmt(ws), to: fmt(now) };
    }
    case "thisMonth":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    case "thisQuarter": {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      return { from: fmt(new Date(now.getFullYear(), qm, 1)), to: fmt(now) };
    }
    case "thisYear":
      return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
    case "last7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: fmt(d), to: fmt(now) };
    }
    case "last30": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: fmt(d), to: fmt(now) };
    }
    case "last90": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { from: fmt(d), to: fmt(now) };
    }
    default:
      return null;
  }
}

// ── Component ──

export default function OrdersOverviewPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [stats, setStats] = useState<OrderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [channels, setChannels] = useState<{ code: string; name: string }[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
    channel: "",
  });

  // Fetch channels once
  useEffect(() => {
    fetch("/api/b2b/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => {});
  }, []);

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "5");

    let dateFrom = filters.dateFrom;
    let dateTo = filters.dateTo;

    if (filters.datePreset !== "all" && filters.datePreset !== "custom") {
      const range = getDateRange(filters.datePreset);
      if (range) {
        dateFrom = range.from;
        dateTo = range.to;
      }
    }

    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (filters.channel) params.set("channel", filters.channel);

    return params.toString();
  }, [filters]);

  // Fetch stats when filters change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/orders?${queryString}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const apiStats = data.stats || {};
          const orders = data.orders || [];

          setStats({
            ...emptyStats,
            ...apiStats,
            valueByStatus: { ...emptyStats.valueByStatus, ...apiStats.valueByStatus },
            timePeriods: { ...emptyStats.timePeriods, ...apiStats.timePeriods },
            conversion: { ...emptyStats.conversion, ...apiStats.conversion },
            recentOrders: orders.slice(0, 5).map((o: { order_id: string; status: string; order_total: number; items: unknown[]; created_at: string }) => ({
              order_id: o.order_id,
              status: o.status,
              order_total: o.order_total,
              items_count: o.items?.length || 0,
              created_at: o.created_at,
            })),
          });
        }
      } catch (error) {
        console.error("Error fetching order stats:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [queryString]);

  const updateFilter = useCallback((updates: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ datePreset: "all", dateFrom: "", dateTo: "", channel: "" });
  }, []);

  const hasActiveFilters = filters.datePreset !== "all" || filters.channel !== "";

  const datePresets = [
    { value: "all", label: t("pages.store.orders.filterAll") },
    { value: "today", label: t("pages.store.orders.filterToday") },
    { value: "yesterday", label: t("pages.store.orders.filterYesterday") },
    { value: "thisWeek", label: t("pages.store.orders.filterThisWeek") },
    { value: "thisMonth", label: t("pages.store.orders.filterThisMonth") },
    { value: "thisQuarter", label: t("pages.store.orders.filterThisQuarter") },
    { value: "thisYear", label: t("pages.store.orders.filterThisYear") },
    { value: "last7", label: t("pages.store.orders.filterLast7") },
    { value: "last30", label: t("pages.store.orders.filterLast30") },
    { value: "last90", label: t("pages.store.orders.filterLast90") },
    { value: "custom", label: t("pages.store.orders.filterCustom") },
  ];

  const statusCards = [
    { key: "draft", label: t("pages.store.orders.activeCarts"), value: stats?.draft || 0, valueAmount: stats?.valueByStatus?.draft || 0, icon: ShoppingCart, color: "bg-amber-500", href: `${tenantPrefix}/b2b/store/orders/carts` },
    { key: "pending", label: t("pages.store.ordersList.pending"), value: stats?.pending || 0, valueAmount: stats?.valueByStatus?.pending || 0, icon: Clock, color: "bg-blue-500", href: `${tenantPrefix}/b2b/store/orders/pending` },
    { key: "confirmed", label: t("pages.store.ordersList.confirmed"), value: stats?.confirmed || 0, valueAmount: stats?.valueByStatus?.confirmed || 0, icon: CheckCircle, color: "bg-emerald-500", href: `${tenantPrefix}/b2b/store/orders/confirmed` },
    { key: "shipped", label: t("pages.store.ordersList.shipped"), value: stats?.shipped || 0, valueAmount: stats?.valueByStatus?.shipped || 0, icon: Truck, color: "bg-purple-500", href: `${tenantPrefix}/b2b/store/orders/shipped` },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-amber-100 text-amber-700",
      quotation: "bg-indigo-100 text-indigo-700",
      pending: "bg-blue-100 text-blue-700",
      confirmed: "bg-emerald-100 text-emerald-700",
      shipped: "bg-purple-100 text-purple-700",
      delivered: "bg-teal-100 text-teal-700",
      cancelled: "bg-gray-100 text-gray-700",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: t("pages.store.orders.title") }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.store.orders.dashboard")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pages.store.orders.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          {t("pages.store.orders.newOrder")}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg bg-card border border-border shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            {t("pages.store.orders.filterLabel")}
          </div>

          {/* Date Preset */}
          <div className="relative">
            <select
              value={filters.datePreset}
              onChange={(e) => updateFilter({ datePreset: e.target.value, dateFrom: "", dateTo: "" })}
              className="appearance-none bg-background border border-border rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              {datePresets.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Custom Date Range */}
          {filters.datePreset === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t("pages.store.orders.dateFrom")}</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter({ dateFrom: e.target.value })}
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t("pages.store.orders.dateTo")}</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter({ dateTo: e.target.value })}
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </>
          )}

          {/* Channel Filter */}
          {channels.length > 0 && (
            <div className="relative">
              <select
                value={filters.channel}
                onChange={(e) => updateFilter({ channel: e.target.value })}
                className="appearance-none bg-background border border-border rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="">{t("pages.store.orders.allChannels")}</option>
                {channels.map((ch) => (
                  <option key={ch.code} value={ch.code}>{ch.name || ch.code}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3.5 w-3.5" />
              {t("pages.store.orders.clearFilters")}
            </button>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="ml-auto">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {isLoading && !stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statusCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className="rounded-lg bg-card p-4 shadow-sm hover:shadow-md transition border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${card.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                      <p className="text-xs text-muted-foreground/80 font-medium">
                        {compactCurrencyFormat.format(card.valueAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.totalOrders")}</p>
                  <p className="text-xl font-bold text-foreground">{stats?.total || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Euro className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.totalValue")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {currencyFormat.format(stats?.totalValue || 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Euro className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.avgOrderValue")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {currencyFormat.format(stats?.avgOrderValue || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Time-Based Metrics + Conversion */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.ordersToday")}</p>
                  <p className="text-xl font-bold text-foreground">{stats?.timePeriods?.today || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.thisWeek")}</p>
                  <p className="text-xl font-bold text-foreground">{stats?.timePeriods?.thisWeek || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100">
                  <CalendarRange className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.thisMonth")}</p>
                  <p className="text-xl font-bold text-foreground">{stats?.timePeriods?.thisMonth || 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("pages.store.orders.conversionRate")}</p>
                  <p className="text-xl font-bold text-foreground">{stats?.conversion?.conversionRate || 0}%</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats?.conversion?.submittedOrders || 0} / {(stats?.conversion?.totalDrafts || 0) + (stats?.conversion?.submittedOrders || 0)} {t("pages.store.orders.conversion")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">{t("pages.store.orders.recentOrders")}</h2>
              </div>
              <Link
                href={`${tenantPrefix}/b2b/store/orders/list`}
                className="text-sm text-primary hover:underline"
              >
                {t("pages.store.orders.viewAll")}
              </Link>
            </div>
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.recentOrders.map((order) => (
                  <Link
                    key={order.order_id}
                    href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-foreground font-mono text-sm">
                          {order.order_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("it-IT", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {currencyFormat.format(order.order_total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.items_count} item{order.items_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t("pages.store.orders.noOrdersYet")}</p>
                <p className="text-sm mt-1">{t("pages.store.orders.ordersWillAppear")}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={showNewOrderModal}
        onClose={() => setShowNewOrderModal(false)}
      />
    </div>
  );
}
