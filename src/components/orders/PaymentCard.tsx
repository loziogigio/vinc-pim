"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  XCircle,
  ArrowRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import type { Order, PaymentRecord } from "@/lib/types/order";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants/order";
import {
  TRANSACTION_STATUS_LABELS,
  PAYMENT_PROVIDER_LABELS,
  type TransactionStatus,
  type PaymentProvider,
} from "@/lib/constants/payment";

// Gateway transaction from paymenttransactions collection
interface GatewayTransaction {
  transaction_id: string;
  payment_number?: string;
  provider: PaymentProvider;
  gross_amount: number;
  currency: string;
  status: TransactionStatus;
  method?: string;
  created_at: string;
}

// Payment method labels in Italian
const PAYMENT_METHOD_IT: Record<string, string> = {
  bank_transfer: "Bonifico Bancario",
  credit_card: "Carta di Credito",
  cash: "Contanti",
  check: "Assegno",
  other: "Altro",
};

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
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

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
    recorded_at: "",
  });

  // Gateway transactions state
  const [gatewayTransactions, setGatewayTransactions] = useState<GatewayTransaction[]>([]);
  const [showGateway, setShowGateway] = useState(false);

  // Fetch gateway transactions linked to this order
  const fetchGatewayTransactions = useCallback(async () => {
    if (!order.order_id) return;
    try {
      const res = await fetch(
        `/api/b2b/payments/transactions?order_id=${encodeURIComponent(order.order_id)}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        setGatewayTransactions(data.transactions || []);
      }
    } catch {
      // Silently fail — gateway section just stays empty
    }
  }, [order.order_id]);

  useEffect(() => {
    fetchGatewayTransactions();
  }, [fetchGatewayTransactions]);

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
      toast.error("Inserisci un importo valido");
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
        toast.success("Pagamento registrato");
        setShowAddPayment(false);
        setNewPayment({ amount: "", method: "bank_transfer", reference: "", notes: "", confirmed: false, recorded_at: "" });
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Errore nella registrazione del pagamento");
      }
    } catch (err) {
      console.error("Error recording payment:", err);
      toast.error("Errore nella registrazione del pagamento");
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
        toast.success("Pagamento eliminato");
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Errore nell'eliminazione del pagamento");
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast.error("Errore nell'eliminazione del pagamento");
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
      toast.error("Inserisci un importo valido");
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
        toast.success("Pagamento aggiornato");
        setEditingPayment(null);
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Errore nell'aggiornamento del pagamento");
      }
    } catch (err) {
      console.error("Error updating payment:", err);
      toast.error("Errore nell'aggiornamento del pagamento");
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
        toast.success(p.confirmed ? "Pagamento non confermato" : "Pagamento confermato");
        onPaymentChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || "Errore nell'aggiornamento del pagamento");
      }
    } catch (err) {
      console.error("Error updating payment:", err);
      toast.error("Errore nell'aggiornamento del pagamento");
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
            <h2 className="font-semibold text-foreground">Pagamento</h2>
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
            <span className="text-muted-foreground">Importo Dovuto</span>
            <span className="font-medium">{formatCurrency(amountDue)}</span>
          </div>
          {pendingAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">In Sospeso</span>
              <span className="font-medium text-amber-600">
                {formatCurrency(pendingAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Importo Pagato</span>
            <span className="font-medium text-emerald-600">
              {formatCurrency(confirmedAmount)}
            </span>
          </div>
          {remainingAfterConfirmed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rimanente</span>
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
            {progressPct.toFixed(0)}% pagato
          </p>
        </div>

        {/* Gateway Transactions */}
        {gatewayTransactions.length > 0 && (
          <div>
            <button
              onClick={() => setShowGateway(!showGateway)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {showGateway ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {gatewayTransactions.length} transazion{gatewayTransactions.length !== 1 ? "i" : "e"} gateway
            </button>

            {showGateway && (
              <div className="mt-2 space-y-1.5">
                {gatewayTransactions.map((tx) => (
                  <GatewayTransactionRow
                    key={tx.transaction_id}
                    tx={tx}
                    tenantPrefix={tenantPrefix}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
              {payments.length} pagament{payments.length !== 1 ? "i" : "o"} registrat{payments.length !== 1 ? "i" : "o"}
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
                            <span className="font-medium">Modifica Pagamento</span>
                            <button
                              onClick={() => setEditingPayment(null)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Importo</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingPayment.amount}
                                onChange={(e) => {
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
                              <label className="text-xs text-muted-foreground">Metodo</label>
                              <select
                                value={editingPayment.method}
                                onChange={(e) =>
                                  setEditingPayment({ ...editingPayment, method: e.target.value })
                                }
                                className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
                              >
                                <option value="bank_transfer">Bonifico Bancario</option>
                                <option value="credit_card">Carta di Credito</option>
                                <option value="cash">Contanti</option>
                                <option value="check">Assegno</option>
                                <option value="other">Altro</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Data e Ora</label>
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
                            <label className="text-xs text-muted-foreground">Riferimento</label>
                            <input
                              type="text"
                              value={editingPayment.reference}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, reference: e.target.value })
                              }
                              placeholder="ID transazione..."
                              className="w-full mt-1 px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Note</label>
                            <input
                              type="text"
                              value={editingPayment.notes}
                              onChange={(e) =>
                                setEditingPayment({ ...editingPayment, notes: e.target.value })
                              }
                              placeholder="Note..."
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
                              Pagamento confermato
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
                            Salva Modifiche
                          </button>
                        </div>
                      ) : (
                        /* Normal Payment Display */
                        <>
                          <div className="flex justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {PAYMENT_METHOD_IT[p.method] || p.method.replace(/_/g, " ")}
                              </span>
                              {p.confirmed ? (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200"
                                  onClick={() => handleToggleConfirmed(p)}
                                  title="Clicca per segnare come non confermato"
                                >
                                  <CheckCircle className="h-2.5 w-2.5" />
                                  Confermato
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200"
                                  onClick={() => handleToggleConfirmed(p)}
                                  title="Clicca per confermare il pagamento"
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  In Sospeso
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
                                    title="Modifica pagamento"
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
                                    title="Elimina pagamento"
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
                            {p.reference && <span>Rif: {p.reference}</span>}
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
              <h3 className="text-sm font-medium">Registra Pagamento</h3>
              <button
                onClick={() => setShowAddPayment(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Importo</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={remainingAfterConfirmed.toFixed(2)}
                  value={newPayment.amount}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value.includes(".") && value.includes(",")) {
                      value = value.replace(/\./g, "").replace(",", ".");
                    } else if (value.includes(",")) {
                      value = value.replace(",", ".");
                    }
                    setNewPayment({ ...newPayment, amount: value });
                  }}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Metodo</label>
                <select
                  value={newPayment.method}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, method: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                >
                  <option value="bank_transfer">Bonifico Bancario</option>
                  <option value="credit_card">Carta di Credito</option>
                  <option value="cash">Contanti</option>
                  <option value="check">Assegno</option>
                  <option value="other">Altro</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Riferimento (opzionale)
                </label>
                <input
                  type="text"
                  placeholder="ID transazione, numero assegno..."
                  value={newPayment.reference}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, reference: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Data e Ora</label>
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
                  Pagamento confermato
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
                Registra Pagamento
              </button>
            </div>
          </div>
        ) : (
          remainingAfterConfirmed > 0 && (
            <button
              onClick={() => {
                setNewPayment(prev => ({
                  ...prev,
                  recorded_at: formatDateForInput(new Date()),
                }));
                setShowAddPayment(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
            >
              <Plus className="h-4 w-4" />
              Registra Pagamento
            </button>
          )
        )}
      </div>

      {/* Delete Payment Confirmation */}
      <ConfirmDialog
        open={deleteConfirmDialog.open}
        title="Elimina Pagamento"
        message={`Sei sicuro di voler eliminare questo pagamento di ${formatCurrency(deleteConfirmDialog.amount)}? I totali verranno aggiornati.`}
        confirmText="Elimina"
        cancelText="Annulla"
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

// ============================================
// GATEWAY TRANSACTION ROW
// ============================================

const GATEWAY_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-emerald-100", text: "text-emerald-700" },
  captured: { bg: "bg-emerald-100", text: "text-emerald-700" },
  processing: { bg: "bg-blue-100", text: "text-blue-700" },
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  authorized: { bg: "bg-sky-100", text: "text-sky-700" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-600" },
  refunded: { bg: "bg-gray-100", text: "text-gray-600" },
  partial_refund: { bg: "bg-orange-100", text: "text-orange-700" },
};

function GatewayTransactionRow({
  tx,
  tenantPrefix,
  formatCurrency,
}: {
  tx: GatewayTransaction;
  tenantPrefix: string;
  formatCurrency: (amount: number) => string;
}) {
  const statusColor = GATEWAY_STATUS_COLORS[tx.status] || GATEWAY_STATUS_COLORS.pending;
  const isFailed = tx.status === "failed" || tx.status === "cancelled";

  return (
    <Link
      href={`${tenantPrefix}/b2b/payments/transactions/${tx.transaction_id}`}
      className="block p-2 rounded bg-muted/50 text-xs hover:bg-muted/80 transition-colors group"
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {PAYMENT_PROVIDER_LABELS[tx.provider] || tx.provider}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor.bg} ${statusColor.text}`}
          >
            {isFailed ? (
              <XCircle className="h-2.5 w-2.5" />
            ) : tx.status === "completed" || tx.status === "captured" ? (
              <CheckCircle className="h-2.5 w-2.5" />
            ) : (
              <Clock className="h-2.5 w-2.5" />
            )}
            {TRANSACTION_STATUS_LABELS[tx.status] || tx.status}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold ${isFailed ? "text-red-500 line-through" : "text-emerald-600"}`}>
            {formatCurrency(tx.gross_amount)}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>
          {tx.payment_number || `...${tx.transaction_id.slice(-8)}`}
        </span>
        <span>
          <Calendar className="inline h-3 w-3 mr-1" />
          {new Date(tx.created_at).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </Link>
  );
}
