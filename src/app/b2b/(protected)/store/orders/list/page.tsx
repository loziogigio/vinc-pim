"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import type { Order } from "@/lib/types/order";
import {
  Search,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  X,
  Eye,
} from "lucide-react";

type FilterState = {
  search: string;
  status: string;
  year: string;
  sort: string;
  date_from: string;
  date_to: string;
  customer_id: string;
  cart_number: string;
  public_code: string;
  erp_code: string;
  is_current: string; // "true" | "false" | "" (empty = all)
};

type OrderStats = {
  draft: number;
  pending: number;
  confirmed: number;
  shipped: number;
  cancelled: number;
  total: number;
  totalValue: number;
};

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export default function OrdersListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState<FilterState>({
    search: searchParams?.get("search") || "",
    status: searchParams?.get("status") || "",
    year: searchParams?.get("year") || "",
    sort: searchParams?.get("sort") || "recent",
    date_from: searchParams?.get("date_from") || "",
    date_to: searchParams?.get("date_to") || "",
    customer_id: searchParams?.get("customer_id") || "",
    cart_number: searchParams?.get("cart_number") || "",
    public_code: searchParams?.get("public_code") || "",
    erp_code: searchParams?.get("erp_code") || "",
    is_current: searchParams?.get("is_current") || "",
  });

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [stats, setStats] = useState<OrderStats>({
    draft: 0,
    pending: 0,
    confirmed: 0,
    shipped: 0,
    cancelled: 0,
    total: 0,
    totalValue: 0,
  });

  // Selection handlers
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.order_id)));
    }
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const isAllSelected = orders.length > 0 && selectedOrders.size === orders.length;
  const isSomeSelected = selectedOrders.size > 0 && selectedOrders.size < orders.length;

  useEffect(() => {
    fetchOrders();
    if (filters.customer_id) {
      fetchCustomerInfo(filters.customer_id);
    } else {
      setCustomerName(null);
    }
  }, [searchParams]);

  async function fetchCustomerInfo(customerId: string) {
    try {
      const res = await fetch(`/api/b2b/customers/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        const customer = data.customer;
        setCustomerName(
          customer.company_name ||
            `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
            customer.email
        );
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
    }
  }

  async function fetchOrders() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");

      if (filters.status) params.set("status", filters.status);
      if (filters.year) params.set("year", filters.year);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.customer_id) params.set("customer_id", filters.customer_id);
      if (filters.cart_number) params.set("cart_number", filters.cart_number);
      if (filters.public_code) params.set("public_code", filters.public_code);
      if (filters.erp_code) params.set("customer_code", filters.erp_code);
      if (filters.is_current) params.set("is_current", filters.is_current);

      const res = await fetch(`/api/b2b/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let ordersList = data.orders || [];

        // Client-side search filter
        if (filters.search) {
          const search = filters.search.toLowerCase();
          ordersList = ordersList.filter(
            (o: Order) =>
              o.order_id.toLowerCase().includes(search) ||
              o.customer_id?.toLowerCase().includes(search) ||
              o.po_reference?.toLowerCase().includes(search)
          );
        }

        setOrders(ordersList);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });

        // Calculate stats from current page (or use API stats if available)
        const newStats: OrderStats = {
          draft: 0,
          pending: 0,
          confirmed: 0,
          shipped: 0,
          cancelled: 0,
          total: data.pagination?.total || ordersList.length,
          totalValue: 0,
        };

        // Use stats from API if available, otherwise calculate from current page
        if (data.stats) {
          Object.assign(newStats, data.stats);
        } else {
          ordersList.forEach((o: Order) => {
            if (o.status in newStats) {
              newStats[o.status as keyof Omit<OrderStats, "total" | "totalValue">]++;
            }
            newStats.totalValue += o.order_total || 0;
          });
        }
        setStats(newStats);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilters(updates: Partial<FilterState>) {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("page", "1");

    router.push(`${tenantPrefix}/b2b/store/orders/list?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", page.toString());
    router.push(`${tenantPrefix}/b2b/store/orders/list?${params.toString()}`);
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ElementType }> = {
      draft: { bg: "bg-amber-100 text-amber-700", icon: ShoppingCart },
      pending: { bg: "bg-blue-100 text-blue-700", icon: Clock },
      confirmed: { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
      shipped: { bg: "bg-purple-100 text-purple-700", icon: Truck },
      cancelled: { bg: "bg-gray-100 text-gray-700", icon: XCircle },
    };
    return styles[status] || { bg: "bg-gray-100 text-gray-700", icon: ShoppingCart };
  };

  const renderEmptyState = () => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <ShoppingCart className="mx-auto h-12 w-12 text-[#b9b9c3] mb-3" />
        <p className="text-[1.05rem] font-semibold">No orders found</p>
        <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">
          {filters.search || filters.status
            ? "Try adjusting your filters"
            : "Orders will appear here once created"}
        </p>
      </div>
    </div>
  );

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: `${tenantPrefix}/b2b/store/orders` },
          { label: "All Orders" },
        ]}
      />

      {/* Stats Summary - Compact */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        <button
          onClick={() => updateFilters({ status: "draft" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            filters.status === "draft" ? "border-amber-400 bg-amber-50" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <ShoppingCart className="h-4 w-4 text-amber-600" />
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.draft}</div>
            <div className="text-[10px] text-muted-foreground">Carts</div>
          </div>
        </button>
        <button
          onClick={() => updateFilters({ status: "pending" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            filters.status === "pending" ? "border-blue-400 bg-blue-50" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <Clock className="h-4 w-4 text-blue-600" />
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.pending}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
        </button>
        <button
          onClick={() => updateFilters({ status: "confirmed" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            filters.status === "confirmed" ? "border-emerald-400 bg-emerald-50" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.confirmed}</div>
            <div className="text-[10px] text-muted-foreground">Confirmed</div>
          </div>
        </button>
        <button
          onClick={() => updateFilters({ status: "shipped" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            filters.status === "shipped" ? "border-purple-400 bg-purple-50" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <Truck className="h-4 w-4 text-purple-600" />
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.shipped}</div>
            <div className="text-[10px] text-muted-foreground">Shipped</div>
          </div>
        </button>
        <button
          onClick={() => updateFilters({ status: "cancelled" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            filters.status === "cancelled" ? "border-red-400 bg-red-50" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <XCircle className="h-4 w-4 text-red-500" />
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.cancelled}</div>
            <div className="text-[10px] text-muted-foreground">Cancelled</div>
          </div>
        </button>
        <button
          onClick={() => updateFilters({ status: "" })}
          className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${
            !filters.status ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
            #
          </div>
          <div className="text-left">
            <div className="text-lg font-bold text-foreground">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
        </button>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
          <div className="h-4 w-4 rounded bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">
            €
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">
              {new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(stats.totalValue)}
            </div>
            <div className="text-[10px] text-muted-foreground">Value</div>
          </div>
        </div>
      </div>

      {/* Customer Filter Banner */}
      {filters.customer_id && customerName && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Viewing orders for: <span className="font-bold">{customerName}</span>
              </p>
              <p className="text-xs text-blue-600">
                {pagination.total} order{pagination.total !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`${tenantPrefix}/b2b/store/customers/${filters.customer_id}`}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View Customer
            </Link>
            <button
              onClick={() => updateFilters({ customer_id: "" })}
              className="ml-2 p-1 hover:bg-blue-100 rounded-full text-blue-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">
          {filters.customer_id && customerName ? `Orders: ${customerName}` : "Orders"}
        </h1>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        {/* Row 1: Search + Status + Year + Sort */}
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search order ID, PO..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="draft">Draft (Cart)</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Year Filter */}
          <select
            value={filters.year}
            onChange={(e) => updateFilters({ year: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="total_high">Highest Value</option>
            <option value="total_low">Lowest Value</option>
          </select>
        </div>

        {/* Row 2: Cart #, Public Code, ERP Code, Active Cart, Date Range */}
        <div className="mt-3 grid gap-3 md:grid-cols-6">
          {/* Cart Number */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Cart #</label>
            <input
              type="text"
              placeholder="e.g. 12"
              value={filters.cart_number}
              onChange={(e) => updateFilters({ cart_number: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none font-mono"
            />
          </div>
          {/* Public Code */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Customer Code</label>
            <input
              type="text"
              placeholder="e.g. C-00001"
              value={filters.public_code}
              onChange={(e) => updateFilters({ public_code: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none font-mono"
            />
          </div>
          {/* ERP Code */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ERP Code</label>
            <input
              type="text"
              placeholder="e.g. CLI-001"
              value={filters.erp_code}
              onChange={(e) => updateFilters({ erp_code: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none font-mono"
            />
          </div>
          {/* Active Cart Filter */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Active Cart</label>
            <select
              value={filters.is_current}
              onChange={(e) => updateFilters({ is_current: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          {/* Date From */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => updateFilters({ date_from: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          {/* Date To */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => updateFilters({ date_to: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Active Filters */}
        {(filters.status || filters.search || filters.year || filters.date_from || filters.date_to || filters.cart_number || filters.public_code || filters.erp_code || filters.is_current) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {filters.status && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                <span>{filters.status}</span>
                <button onClick={() => updateFilters({ status: "" })} className="hover:bg-primary/20 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.is_current && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                <span>{filters.is_current === "true" ? "Active Cart" : "Inactive"}</span>
                <button onClick={() => updateFilters({ is_current: "" })} className="hover:bg-emerald-200 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.year && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                <span>{filters.year}</span>
                <button onClick={() => updateFilters({ year: "" })} className="hover:bg-primary/20 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.cart_number && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-mono">
                <span>Cart #{filters.cart_number}</span>
                <button onClick={() => updateFilters({ cart_number: "" })} className="hover:bg-amber-200 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.public_code && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-mono">
                <span>{filters.public_code}</span>
                <button onClick={() => updateFilters({ public_code: "" })} className="hover:bg-blue-200 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.erp_code && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-mono">
                <span>ERP: {filters.erp_code}</span>
                <button onClick={() => updateFilters({ erp_code: "" })} className="hover:bg-gray-200 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(filters.date_from || filters.date_to) && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                <span>{filters.date_from || "..."} → {filters.date_to || "..."}</span>
                <button onClick={() => updateFilters({ date_from: "", date_to: "" })} className="hover:bg-primary/20 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.search && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                <span>&quot;{filters.search}&quot;</span>
                <button onClick={() => updateFilters({ search: "" })} className="hover:bg-primary/20 rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => updateFilters({ status: "", year: "", search: "", date_from: "", date_to: "", customer_id: "", cart_number: "", public_code: "", erp_code: "", is_current: "" })}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Selection Actions Toolbar */}
      {selectedOrders.size > 0 && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-foreground">
                <span className="font-bold">{selectedOrders.size}</span> order
                {selectedOrders.size !== 1 ? "s" : ""} selected
              </div>
              <button
                onClick={clearSelection}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-lg bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        title={isAllSelected ? "Deselect all" : "Select all"}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => {
                    const statusStyle = getStatusBadge(order.status);
                    const StatusIcon = statusStyle.icon;
                    return (
                      <tr key={order.order_id} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.order_id)}
                            onChange={() => toggleSelectOrder(order.order_id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* Order Number (prominent) - shown for confirmed/shipped orders */}
                            {order.order_number && (
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-sm">
                                #{order.order_number}
                              </span>
                            )}
                            {/* Cart Number - always shown if available (every order was a cart) */}
                            {order.cart_number && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium text-sm">
                                Cart #{order.cart_number}
                              </span>
                            )}
                          </div>
                          <Link
                            href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                            className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            {order.order_id}
                          </Link>
                          {order.po_reference && (
                            <div className="text-xs text-muted-foreground">
                              PO: {order.po_reference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            {(order as Order & { customer_name?: string }).customer_name || order.customer_id}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {/* Public Code (Primary - most important) */}
                            {(order as Order & { customer_public_code?: string }).customer_public_code && (
                              <Link
                                href={`${tenantPrefix}/b2b/store/customers/${order.customer_id}`}
                                className="text-primary hover:underline font-mono font-semibold"
                                title="Public Customer Code"
                              >
                                {(order as Order & { customer_public_code?: string }).customer_public_code}
                              </Link>
                            )}
                            {/* ERP Code (Secondary) */}
                            {order.customer_code && (
                              <span className="text-muted-foreground font-mono" title="ERP Code">
                                ({order.customer_code})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                            {order.items?.length || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-foreground">
                            {new Intl.NumberFormat("it-IT", {
                              style: "currency",
                              currency: order.currency || "EUR",
                            }).format(order.order_total)}
                          </div>
                          {order.total_discount > 0 && (
                            <div className="text-xs text-emerald-600">
                              -{new Intl.NumberFormat("it-IT", {
                                style: "currency",
                                currency: order.currency || "EUR",
                              }).format(order.total_discount)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("it-IT", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            <div className="text-xs text-muted-foreground/70">
                              {new Date(order.created_at).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground" title={order.updated_at ? new Date(order.updated_at).toLocaleString("it-IT") : ""}>
                            {order.updated_at ? formatTimeAgo(order.updated_at) : "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} orders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-medium text-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
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
