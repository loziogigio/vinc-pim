"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  TrendingUp,
  Package,
  Euro,
  Plus,
} from "lucide-react";
import { NewOrderModal } from "@/components/orders/NewOrderModal";

interface OrderStats {
  draft: number;
  pending: number;
  confirmed: number;
  shipped: number;
  cancelled: number;
  total: number;
  totalValue: number;
  recentOrders: Array<{
    order_id: string;
    status: string;
    order_total: number;
    items_count: number;
    created_at: string;
  }>;
}

export default function OrdersOverviewPage() {
  const pathname = usePathname();

  // Extract tenant from URL (e.g., /dfl-eventi-it/b2b/store/orders -> dfl-eventi-it)
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [stats, setStats] = useState<OrderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setIsLoading(true);
    try {
      // Fetch orders to calculate stats
      const res = await fetch("/api/b2b/orders?limit=100");
      if (res.ok) {
        const data = await res.json();
        const orders = data.orders || [];

        // Calculate stats
        const stats: OrderStats = {
          draft: orders.filter((o: { status: string }) => o.status === "draft").length,
          pending: orders.filter((o: { status: string }) => o.status === "pending").length,
          confirmed: orders.filter((o: { status: string }) => o.status === "confirmed").length,
          shipped: orders.filter((o: { status: string }) => o.status === "shipped").length,
          cancelled: orders.filter((o: { status: string }) => o.status === "cancelled").length,
          total: orders.length,
          totalValue: orders.reduce((sum: number, o: { order_total: number }) => sum + (o.order_total || 0), 0),
          recentOrders: orders.slice(0, 5).map((o: { order_id: string; status: string; order_total: number; items: unknown[]; created_at: string }) => ({
            order_id: o.order_id,
            status: o.status,
            order_total: o.order_total,
            items_count: o.items?.length || 0,
            created_at: o.created_at,
          })),
        };

        setStats(stats);
      }
    } catch (error) {
      console.error("Error fetching order stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statusCards = [
    { label: "Active Carts", value: stats?.draft || 0, icon: ShoppingCart, color: "bg-amber-500", href: `${tenantPrefix}/b2b/store/orders/carts` },
    { label: "Pending", value: stats?.pending || 0, icon: Clock, color: "bg-blue-500", href: `${tenantPrefix}/b2b/store/orders/pending` },
    { label: "Confirmed", value: stats?.confirmed || 0, icon: CheckCircle, color: "bg-emerald-500", href: `${tenantPrefix}/b2b/store/orders/confirmed` },
    { label: "Shipped", value: stats?.shipped || 0, icon: Truck, color: "bg-purple-500", href: `${tenantPrefix}/b2b/store/orders/shipped` },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-amber-100 text-amber-700",
      pending: "bg-blue-100 text-blue-700",
      confirmed: "bg-emerald-100 text-emerald-700",
      shipped: "bg-purple-100 text-purple-700",
      cancelled: "bg-gray-100 text-gray-700",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Orders" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your orders and carts
          </p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {isLoading ? (
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
                  key={card.label}
                  href={card.href}
                  className="rounded-lg bg-card p-4 shadow-sm hover:shadow-md transition border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${card.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
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
                  <p className="text-sm text-muted-foreground">Total Orders</p>
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
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold text-foreground">
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    }).format(stats?.totalValue || 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                  <p className="text-xl font-bold text-foreground">{stats?.cancelled || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Recent Orders</h2>
              </div>
              <Link
                href={`${tenantPrefix}/b2b/store/orders/list`}
                className="text-sm text-primary hover:underline"
              >
                View all
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
                          {new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(order.order_total)}
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
                <p>No orders yet</p>
                <p className="text-sm mt-1">Orders will appear here once created</p>
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
