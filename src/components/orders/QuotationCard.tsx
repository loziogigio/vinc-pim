"use client";

import { useState } from "react";
import {
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, QuotationData, QuotationRevision } from "@/lib/types/order";
import { QUOTATION_STATUS_LABELS, type QuotationStatus } from "@/lib/constants/order";

interface QuotationCardProps {
  order: Order;
  onQuotationChange?: () => void;
}

export function QuotationCard({ order, onQuotationChange }: QuotationCardProps) {
  const [showRevisions, setShowRevisions] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const quotation = order.quotation;

  if (!quotation) {
    return null;
  }

  // Check if quotation is expired
  const isExpired =
    quotation.valid_until && new Date(quotation.valid_until) < new Date();

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: "bg-gray-100", text: "text-gray-700" },
    sent: { bg: "bg-blue-100", text: "text-blue-700" },
    counter_offer: { bg: "bg-amber-100", text: "text-amber-700" },
    revised: { bg: "bg-indigo-100", text: "text-indigo-700" },
    accepted: { bg: "bg-emerald-100", text: "text-emerald-700" },
    rejected: { bg: "bg-red-100", text: "text-red-700" },
    expired: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  const currentStatus = isExpired ? "expired" : quotation.quotation_status;
  const statusStyle = statusColors[currentStatus] || statusColors.draft;

  // Handle quotation actions
  const handleAction = async (action: string) => {
    setIsLoading(action);
    try {
      const res = await fetch(
        `/api/b2b/orders/${order.order_id}/quotation?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Quotation ${action} successful`);
        onQuotationChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || `Failed to ${action} quotation`);
      }
    } catch (err) {
      console.error(`Error ${action} quotation:`, err);
      toast.error(`Failed to ${action} quotation`);
    } finally {
      setIsLoading(null);
    }
  };

  // Get available actions based on quotation status
  const getActions = () => {
    const actions: Array<{
      label: string;
      action: string;
      icon: React.ElementType;
      variant: "primary" | "secondary" | "danger";
    }> = [];

    if (isExpired) {
      return actions; // No actions for expired quotations
    }

    switch (quotation.quotation_status) {
      case "draft":
        actions.push({
          label: "Send Quotation",
          action: "send",
          icon: Send,
          variant: "primary",
        });
        break;

      case "sent":
      case "revised":
        actions.push({
          label: "Accept",
          action: "accept",
          icon: CheckCircle,
          variant: "primary",
        });
        actions.push({
          label: "Reject",
          action: "reject",
          icon: XCircle,
          variant: "danger",
        });
        break;

      case "counter_offer":
        actions.push({
          label: "Revise & Send",
          action: "revise",
          icon: RefreshCw,
          variant: "primary",
        });
        actions.push({
          label: "Reject",
          action: "reject",
          icon: XCircle,
          variant: "danger",
        });
        break;
    }

    return actions;
  };

  const actions = getActions();

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: order.currency || "EUR",
    }).format(amount);

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-foreground">Quotation</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            {isExpired && <AlertTriangle className="h-3 w-3" />}
            {QUOTATION_STATUS_LABELS[currentStatus as QuotationStatus]}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Quotation Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quotation #</span>
            <span className="font-mono font-medium">
              {quotation.quotation_number}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revision</span>
            <span className="font-medium">Rev {quotation.current_revision}</span>
          </div>
          {quotation.valid_until && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valid Until</span>
              <span
                className={`font-medium ${isExpired ? "text-red-600" : ""}`}
              >
                <Calendar className="inline h-3 w-3 mr-1" />
                {new Date(quotation.valid_until).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last Actor</span>
            <span className="font-medium capitalize">
              {quotation.last_actor || "—"}
            </span>
          </div>
        </div>

        {/* Totals */}
        <div className="pt-3 border-t border-border space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (Net)</span>
            <span className="font-medium">{formatCurrency(order.subtotal_net)}</span>
          </div>
          {order.cart_discounts && order.cart_discounts.length > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Cart Discounts</span>
              <span>
                -
                {formatCurrency(
                  order.cart_discounts.reduce((sum, d) => sum + d.value, 0)
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(order.order_total)}</span>
          </div>
        </div>

        {/* Revision History Toggle */}
        {quotation.revisions && quotation.revisions.length > 0 && (
          <div>
            <button
              onClick={() => setShowRevisions(!showRevisions)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {showRevisions ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              View {quotation.revisions.length} revision
              {quotation.revisions.length !== 1 ? "s" : ""}
            </button>

            {showRevisions && (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {quotation.revisions
                  .slice()
                  .reverse()
                  .map((rev) => (
                    <div
                      key={rev.revision_number}
                      className="p-2 rounded bg-muted/50 text-xs"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">
                          Rev {rev.revision_number}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(rev.created_at).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span className="capitalize">{rev.actor_type}</span>
                        <span>{formatCurrency(rev.order_total)}</span>
                      </div>
                      {rev.notes && (
                        <p className="mt-1 text-muted-foreground italic">
                          "{rev.notes}"
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

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
                  onClick={() => handleAction(action.action)}
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
