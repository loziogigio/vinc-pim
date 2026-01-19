"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Order } from "@/lib/types/order";
import {
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Search,
  X,
} from "lucide-react";

interface OrdersStatusListProps {
  status: string;
  statusLabel: string;
  emptyMessage: string;
}

const statusIcons: Record<string, React.ElementType> = {
  draft: ShoppingCart,
  pending: Clock,
  confirmed: CheckCircle,
  shipped: Truck,
  cancelled: XCircle,
};

export function OrdersStatusList({ status, statusLabel, emptyMessage }: OrdersStatusListProps) {
  const pathname = usePathname();
  // Extract tenant prefix from URL (e.g., "/dfl-eventi-it/b2b/store/orders/confirmed" -> "/dfl-eventi-it")
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, [pagination.page, status, dateFrom, dateTo]);

  async function fetchOrders() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", "20");
      params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/b2b/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let ordersList = data.orders || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          ordersList = ordersList.filter(
            (o: Order) =>
              o.order_id.toLowerCase().includes(searchLower) ||
              o.customer_id?.toLowerCase().includes(searchLower) ||
              o.po_reference?.toLowerCase().includes(searchLower)
          );
        }

        setOrders(ordersList);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 0,
        }));
      }
    } catch (error) {
      console.error(`Error fetching ${status} orders:`, error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch() {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchOrders();
  }

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function goToPage(page: number) {
    setPagination((prev) => ({ ...prev, page }));
  }

  const StatusIcon = statusIcons[status] || ShoppingCart;
  const hasFilters = search || dateFrom || dateTo;

  const renderEmptyState = () => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <StatusIcon className="mx-auto h-12 w-12 text-[#b9b9c3] mb-3" />
        <p className="text-[1.05rem] font-semibold">No {statusLabel.toLowerCase()} orders</p>
        <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{emptyMessage}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by order ID, customer, or PO reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="From date"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="To date"
            />
          </div>
        </div>

        {/* Active Filters */}
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {search && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Search: &quot;{search}&quot;</span>
                <button
                  onClick={() => { setSearch(""); fetchOrders(); }}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {(dateFrom || dateTo) && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>
                  Date: {dateFrom || "..."} to {dateTo || "..."}
                </span>
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {order.order_id}
                      </Link>
                      {order.order_number && (
                        <div className="text-xs text-muted-foreground">
                          #{order.order_number}/{order.year}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {order.customer_id}
                      </div>
                      {order.po_reference && (
                        <div className="text-xs text-muted-foreground">
                          PO: {order.po_reference}
                        </div>
                      )}
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("it-IT", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                        className="flex items-center justify-end gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
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
