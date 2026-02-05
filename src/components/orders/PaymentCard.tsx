"use client";

import { useState } from "react";
import {
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Calendar,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import type { Order, PaymentRecord } from "@/lib/types/order";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants/order";

interface PaymentCardProps {
  order: Order;
  onPaymentChange?: () => void;
}

interface EditingPayment {
  payment_id: string;
  amount: string;
  method: string;
  reference: string;
  notes: string;
  recorded_at: string;
  confirmed: boolean;
}

export function PaymentCard({ order, onPaymentChange }: PaymentCardProps) {
  const [showPayments, setShowPayments] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<EditingPayment | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    paymentId: string;
    amount: number;
  }>({ open: false, paymentId: "", amount: 0 });
  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: "bank_transfer",
    reference: "",
    notes: "",
    confirmed: false,
    recorded_at: "", // Will be set when form opens
  });

  const payment = order.payment;

  // Only show for confirmed/shipped/delivered orders
  if (!["confirmed", "shipped", "delivered"].includes(order.status)) {
    return null;
  }

  // Initialize payment data if not present
  const paymentStatus = payment?.payment_status || "awaiting";
  const amountDue = payment?.amount_due ?? order.order_total;
  const payments = payment?.payments || [];

  // Calculate pending and confirmed amounts from payments
  const pendingAmount = payments
    .filter((p) => !p.confirmed)
    .reduce((sum, p) => sum + p.amount, 0);
  const confirmedAmount = payments
    .filter((p) => p.confirmed)
    .reduce((sum, p) => sum + p.amount, 0);

  // Remaining is based on confirmed payments only
  const remainingAfterConfirmed = amountDue - confirmedAmount;

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    not_required: { bg: "bg-gray-100", text: "text-gray-600", icon: CheckCircle },
    awaiting: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
    partial: { bg: "bg-orange-100", text: "text-orange-700", icon: AlertTriangle },
    paid: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
    failed: { bg: "bg-red-100", text: "text-red-700", icon: AlertTriangle },
    refunded: { bg: "bg-gray-100", text: "text-gray-600", icon: CreditCard },
  };

  const statusStyle = statusColors[paymentStatus] || statusColors.awaiting;
  const StatusIcon = statusStyle.icon;

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: order.currency || "EUR",
    }).format(amount);

  // Payment progress percentage (based on confirmed payments)
  const progressPct = amountDue > 0 ? Math.min((confirmedAmount / amountDue) * 100, 100) : 0;

  // Format date for datetime-local input
  const formatDateForInput = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  // Handle add payment
  const handleAddPayment = async () => {
    const amount = parseFloat(newPayment.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: newPayment.method,
          reference: newPayment.reference || undefined,
          notes: newPayment.notes || undefined,
          confirmed: newPayment.confirmed,
          recorded_at: newPayment.recorded_at ? new Date(newPayment.recorded_at).toISOString() : undefined,
        }),
      });

      if (res.ok) {
        toast.success("Payment recorded successfully");
        setShowAddPayment(false);
        setNewPayment({ amount: "", method: "bank_transfer", reference: "", notes: "", confirmed: false, recorded_at: "" });
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to record payment");
      }
    } catch (err) {
      console.error("Error recording payment:", err);
      toast.error("Failed to record payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete payment
  const handleDeletePayment = async (paymentId: string) => {
    setDeletingPaymentId(paymentId);
    try {
      const res = await fetch(
        `/api/b2b/orders/${order.order_id}/payment?payment_id=${paymentId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Payment deleted");
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete payment");
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast.error("Failed to delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Start editing a payment
  const startEditPayment = (p: PaymentRecord) => {
    setEditingPayment({
      payment_id: p.payment_id,
      amount: p.amount.toString(),
      method: p.method,
      reference: p.reference || "",
      notes: p.notes || "",
      recorded_at: formatDateForInput(p.recorded_at),
      confirmed: p.confirmed ?? false,
    });
  };

  // Handle edit payment
  const handleEditPayment = async () => {
    if (!editingPayment) return;

    const amount = parseFloat(editingPayment.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: editingPayment.payment_id,
          amount,
          method: editingPayment.method,
          reference: editingPayment.reference || undefined,
          notes: editingPayment.notes || undefined,
          recorded_at: new Date(editingPayment.recorded_at).toISOString(),
          confirmed: editingPayment.confirmed,
        }),
      });

      if (res.ok) {
        toast.success("Payment updated");
        setEditingPayment(null);
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update payment");
      }
    } catch (err) {
      console.error("Error updating payment:", err);
      toast.error("Failed to update payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle confirmed status directly
  const handleToggleConfirmed = async (p: PaymentRecord) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: p.payment_id,
          confirmed: !p.confirmed,
        }),
      });

      if (res.ok) {
        toast.success(p.confirmed ? "Payment marked as unconfirmed" : "Payment confirmed");
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update payment");
      }
    } catch (err) {
      console.error("Error updating payment:", err);
      toast.error("Failed to update payment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold text-foreground">Payment</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            <StatusIcon className="h-3 w-3" />
            {PAYMENT_STATUS_LABELS[paymentStatus as PaymentStatus]}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Payment Summary */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Due</span>
            <span className="font-medium">{formatCurrency(amountDue)}</span>
          </div>
          {pendingAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pending Amount</span>
              <span className="font-medium text-amber-600">
                {formatCurrency(pendingAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-medium text-emerald-600">
              {formatCurrency(confirmedAmount)}
            </span>
          </div>
          {remainingAfterConfirmed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(remainingAfterConfirmed)}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                progressPct >= 100
                  ? "bg-emerald-500"
                  : progressPct > 0
                    ? "bg-amber-500"
                    : "bg-gray-300"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {progressPct.toFixed(0)}% paid
          </p>
        </div>

        {/* Payment History Toggle */}
        {payments.length > 0 && (
          <div>
            <button
              onClick={() => setShowPayments(!showPayments)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {showPayments ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              View {payments.length} payment{payments.length !== 1 ? "s" : ""}
            </button>

            {showPayments && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {payments
                  .slice()
                  .reverse()
                  .map((p, idx) => (
                    <div
                      key={p.payment_id || idx}
                      className="p-2 rounded bg-muted/50 text-xs group"
                    >
                      {/* Editing Form */}
                      {editingPayment?.payment_id === p.payment_id ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Edit Payment</span>
                            <button
                              onClick={() => setEditingPayment(null)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Amount</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingPayment.amount}
                                onChange={(e) => {
                                  // Normalize Italian format: remove dots (thousand sep), replace comma with dot (decimal)
                                  let value = e.target.value;
                                  if (value.includes(".") && value.includes(",")) {
                                    value = value.replace(/\./g, "").replace(",", ".");
                                  } else if (value.includes(",")) {
                                    value = value.replace(",", ".");
                                  }
                                  setEditingPayment({ ...editingPayment, amount: value });
                                }}
                                className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Method</label>
                              <select
                                value={editingPayment.method}
                                onChange={(e) =>
                                  setEditingPayment({ ...editingPayment, method: e.target.value })
                                }
                                className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
                              >
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="cash">Cash</option>
                                <option value="check">Check</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Date & Time</label>
                            <input
                              type="datetime-local"
                              value={editingPayment.recorded_at}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, recorded_at: e.target.value })
                              }
                              className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Reference</label>
                            <input
                              type="text"
                              value={editingPayment.reference}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, reference: e.target.value })
                              }
                              placeholder="Transaction ID..."
                              className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Notes</label>
                            <input
                              type="text"
                              value={editingPayment.notes}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, notes: e.target.value })
                              }
                              placeholder="Notes..."
                              className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-confirmed-${p.payment_id}`}
                              checked={editingPayment.confirmed}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, confirmed: e.target.checked })
                              }
                              className="h-3 w-3 rounded border-border"
                            />
                            <label htmlFor={`edit-confirmed-${p.payment_id}`} className="text-xs text-muted-foreground">
                              Payment confirmed
                            </label>
                          </div>

                          <button
                            onClick={handleEditPayment}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 text-xs font-medium disabled:opacity-50"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Save Changes
                          </button>
                        </div>
                      ) : (
                        /* Normal Payment Display */
                        <>
                          <div className="flex justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize">
                                {p.method.replace(/_/g, " ")}
                              </span>
                              {p.confirmed ? (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200"
                                  onClick={() => handleToggleConfirmed(p)}
                                  title="Click to mark as unconfirmed"
                                >
                                  <CheckCircle className="h-2.5 w-2.5" />
                                  Confirmed
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200"
                                  onClick={() => handleToggleConfirmed(p)}
                                  title="Click to confirm payment"
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-emerald-600">
                                {formatCurrency(p.amount)}
                              </span>
                              {p.payment_id && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditPayment(p)}
                                    className="p-1 rounded hover:bg-blue-100 text-blue-500"
                                    title="Edit payment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteConfirmDialog({
                                        open: true,
                                        paymentId: p.payment_id,
                                        amount: p.amount,
                                      })
                                    }
                                    disabled={deletingPaymentId === p.payment_id}
                                    className="p-1 rounded hover:bg-red-100 text-red-500 disabled:opacity-50"
                                    title="Delete payment"
                                  >
                                    {deletingPaymentId === p.payment_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>
                              <Calendar className="inline h-3 w-3 mr-1" />
                              {new Date(p.recorded_at).toLocaleDateString("it-IT", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {p.reference && <span>Ref: {p.reference}</span>}
                          </div>
                          {p.notes && (
                            <div className="mt-1 text-muted-foreground italic">
                              {p.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Add Payment Form */}
        {showAddPayment ? (
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Record Payment</h3>
              <button
                onClick={() => setShowAddPayment(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={remainingAfterConfirmed.toFixed(2)}
                  value={newPayment.amount}
                  onChange={(e) => {
                    // Normalize Italian format: remove dots (thousand sep), replace comma with dot (decimal)
                    let value = e.target.value;
                    // If contains both dot and comma, assume Italian format (1.234,56)
                    if (value.includes(".") && value.includes(",")) {
                      value = value.replace(/\./g, "").replace(",", ".");
                    } else if (value.includes(",")) {
                      // Just comma - treat as decimal separator
                      value = value.replace(",", ".");
                    }
                    setNewPayment({ ...newPayment, amount: value });
                  }}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Method</label>
                <select
                  value={newPayment.method}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, method: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Reference (optional)
                </label>
                <input
                  type="text"
                  placeholder="Transaction ID, check number..."
                  value={newPayment.reference}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, reference: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newPayment.recorded_at}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, recorded_at: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="new-payment-confirmed"
                  checked={newPayment.confirmed}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, confirmed: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="new-payment-confirmed" className="text-sm text-muted-foreground">
                  Payment confirmed
                </label>
              </div>

              <button
                onClick={handleAddPayment}
                disabled={isLoading || !newPayment.amount}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Record Payment
              </button>
            </div>
          </div>
        ) : (
          remainingAfterConfirmed > 0 && (
            <button
              onClick={() => {
                // Set default date to now when opening form
                setNewPayment(prev => ({
                  ...prev,
                  recorded_at: formatDateForInput(new Date()),
                }));
                setShowAddPayment(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
            >
              <Plus className="h-4 w-4" />
              Record Payment
            </button>
          )
        )}
      </div>

      {/* Delete Payment Confirmation */}
      <ConfirmDialog
        open={deleteConfirmDialog.open}
        title="Delete Payment"
        message={`Are you sure you want to delete this payment of ${formatCurrency(deleteConfirmDialog.amount)}? This will update the payment totals.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          setDeleteConfirmDialog({ open: false, paymentId: "", amount: 0 });
          handleDeletePayment(deleteConfirmDialog.paymentId);
        }}
        onCancel={() =>
          setDeleteConfirmDialog({ open: false, paymentId: "", amount: 0 })
        }
      />
    </div>
  );
}
