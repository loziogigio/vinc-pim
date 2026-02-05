"use client";

import { useState } from "react";
import {
  Activity,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  Package,
  XCircle,
  FileText,
  ArrowRight,
  Loader2,
  Copy,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus } from "@/lib/types/order";
import {
  ORDER_STATUS_LABELS,
  canTransition,
  getAllowedTransitions,
  type UserRole,
} from "@/lib/constants/order";

interface StatusActionsCardProps {
  order: Order;
  userRole?: UserRole;
  onStatusChange?: () => void;
  tenantPrefix?: string;
}

export function StatusActionsCard({
  order,
  userRole = "admin",
  onStatusChange,
  tenantPrefix = "",
}: StatusActionsCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; bgColor: string }
  > = {
    draft: {
      icon: ShoppingCart,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    quotation: {
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
    pending: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-100" },
    confirmed: {
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    shipped: {
      icon: Truck,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    delivered: {
      icon: Package,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    cancelled: { icon: XCircle, color: "text-gray-600", bgColor: "bg-gray-100" },
  };

  const currentStatus = statusConfig[order.status] || statusConfig.draft;
  const StatusIcon = currentStatus.icon;

  // Get available actions based on current status and user role
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      action: string;
      icon: React.ElementType;
      variant: "primary" | "secondary" | "danger";
      endpoint?: string;
    }> = [];

    switch (order.status) {
      case "draft":
        actions.push({
          label: "Convert to Quotation",
          action: "to-quotation",
          icon: FileText,
          variant: "secondary",
          endpoint: `/api/b2b/orders/${order.order_id}/to-quotation`,
        });
        actions.push({
          label: "Submit Order",
          action: "submit",
          icon: Send,
          variant: "primary",
          endpoint: `/api/b2b/orders/${order.order_id}/submit`,
        });
        break;

      case "quotation":
        if (order.quotation?.quotation_status === "accepted") {
          actions.push({
            label: "Confirm Order",
            action: "confirm",
            icon: CheckCircle,
            variant: "primary",
            endpoint: `/api/b2b/orders/${order.order_id}/confirm`,
          });
        }
        break;

      case "pending":
        actions.push({
          label: "Confirm Order",
          action: "confirm",
          icon: CheckCircle,
          variant: "primary",
          endpoint: `/api/b2b/orders/${order.order_id}/confirm`,
        });
        break;

      case "confirmed":
        actions.push({
          label: "Mark as Shipped",
          action: "ship",
          icon: Truck,
          variant: "primary",
          endpoint: `/api/b2b/orders/${order.order_id}/ship`,
        });
        break;

      case "shipped":
        actions.push({
          label: "Mark as Delivered",
          action: "deliver",
          icon: Package,
          variant: "primary",
          endpoint: `/api/b2b/orders/${order.order_id}/deliver`,
        });
        break;

      case "delivered":
        actions.push({
          label: "Duplicate Order",
          action: "duplicate",
          icon: Copy,
          variant: "secondary",
          endpoint: `/api/b2b/orders/${order.order_id}/duplicate`,
        });
        break;
    }

    // Cancel action (available for most statuses)
    if (!["delivered", "cancelled"].includes(order.status)) {
      if (canTransition(order.status as OrderStatus, "cancelled", userRole)) {
        actions.push({
          label: "Cancel Order",
          action: "cancel",
          icon: XCircle,
          variant: "danger",
          endpoint: `/api/b2b/orders/${order.order_id}/cancel`,
        });
      }
    }

    return actions;
  };

  const handleAction = async (action: string, endpoint?: string) => {
    if (!endpoint) return;

    setIsLoading(action);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          data.message ||
            `Order ${action === "duplicate" ? "duplicated" : "updated"} successfully`
        );
        onStatusChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || `Failed to ${action} order`);
      }
    } catch (err) {
      console.error(`Error ${action} order:`, err);
      toast.error(`Failed to ${action} order`);
    } finally {
      setIsLoading(null);
    }
  };

  const actions = getAvailableActions();

  // Status timeline
  const statusTimeline = [
    { status: "draft", label: "Draft" },
    { status: "quotation", label: "Quotation", optional: true },
    { status: "pending", label: "Pending", optional: true },
    { status: "confirmed", label: "Confirmed" },
    { status: "shipped", label: "Shipped" },
    { status: "delivered", label: "Delivered" },
  ];

  const currentIndex = statusTimeline.findIndex(
    (s) => s.status === order.status
  );

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Status & Actions</h2>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Current Status */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${currentStatus.bgColor}`}>
            <StatusIcon className={`h-5 w-5 ${currentStatus.color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Status</p>
            <p className="font-semibold text-foreground">
              {ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status}
            </p>
          </div>
        </div>

        {/* Progress Timeline */}
        {order.status !== "cancelled" && (
          <div className="flex items-center gap-1 py-2">
            {statusTimeline
              .filter((s) => !s.optional || s.status === order.status)
              .map((step, idx, arr) => {
                const stepIndex = statusTimeline.findIndex(
                  (s) => s.status === step.status
                );
                const isCompleted = stepIndex < currentIndex;
                const isCurrent = step.status === order.status;
                const isLast = idx === arr.length - 1;

                return (
                  <div key={step.status} className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-8 h-0.5 ${
                          isCompleted ? "bg-emerald-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-2 text-xs">
          {order.submitted_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">
                {new Date(order.submitted_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {order.confirmed_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmed</span>
              <span className="font-medium">
                {new Date(order.confirmed_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {order.shipped_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipped</span>
              <span className="font-medium">
                {new Date(order.shipped_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {order.delivered_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivered</span>
              <span className="font-medium">
                {new Date(order.delivered_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {actions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {actions.map((action) => {
              const ActionIcon = action.icon;
              const isActionLoading = isLoading === action.action;

              const buttonStyles = {
                primary:
                  "bg-primary text-white hover:bg-primary/90 border-primary",
                secondary:
                  "bg-background text-foreground hover:bg-muted border-border",
                danger: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
              };

              return (
                <button
                  key={action.action}
                  onClick={() => handleAction(action.action, action.endpoint)}
                  disabled={isLoading !== null}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition disabled:opacity-50 ${buttonStyles[action.variant]}`}
                >
                  {isActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ActionIcon className="h-4 w-4" />
                  )}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
