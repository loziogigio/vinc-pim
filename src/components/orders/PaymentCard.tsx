"use client";

import { useState, useEffect, useCallback } from "react";
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
  ArrowRight,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import type { Order, PaymentRecord } from "@/lib/types/order";
import {
  normalizeDecimalInput,
  parseDecimalValue,
} from "@/lib/utils/decimal-input";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants/order";
import {
  GatewayTransactionRow,
  type GatewayTransaction,
} from "./GatewayTransactionRow";

// Manual payment recording methods and labels
const MANUAL_PAYMENT_METHODS = [
  "bank_transfer",
  "credit_card",
  "cash",
  "check",
  "other",
] as const;

const PAYMENT_METHOD_IT: Record<string, string> = {
  bank_transfer: "Bonifico Bancario",
  credit_card: "Carta di Credito",
  cash: "Contanti",
  check: "Assegno",
  other: "Altro",
};

// Maps manual recording methods to canonical payment methods (from shipping restrictions)
const MANUAL_TO_CANONICAL: Record<string, string[]> = {
  bank_transfer: ["bank_transfer"],
  credit_card: ["credit_card", "debit_card"],
  cash: ["cash_on_delivery"],
  check: [], // always allowed (no canonical equivalent)
  other: [], // always allowed (catch-all)
};

function getAllowedManualMethods(restrictions?: string[]): string[] {
  if (!restrictions || restrictions.length === 0) {
    return [...MANUAL_PAYMENT_METHODS];
  }
  return MANUAL_PAYMENT_METHODS.filter((m) => {
    const canonical = MANUAL_TO_CANONICAL[m];
    if (canonical.length === 0) return true; // always shown
    return canonical.some((c) => restrictions.includes(c));
  });
}

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
  const [processingConfirmOpen, setProcessingConfirmOpen] = useState(false);
  const allowedMethods = getAllowedManualMethods(order.allowed_payment_methods);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: allowedMethods[0] || "bank_transfer",
    reference: "",
    notes: "",
    confirmed: false,
    recorded_at: "",
  });

  // Gateway transactions state
  const [gatewayTransactions, setGatewayTransactions] = useState<GatewayTransaction[]>([]);
  const [showGateway, setShowGateway] = useState(false);

  // Payment link generation state
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [linkAmount, setLinkAmount] = useState("");

  // B2C storefront destination state
  const [storefronts, setStorefronts] = useState<
    Array<{ slug: string; name: string; domains: string[]; branding?: { title?: string } }>
  >([]);
  const [selectedDestination, setSelectedDestination] = useState("generic");

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

  // Fetch active B2C storefronts for destination selector
  useEffect(() => {
    async function fetchStorefronts() {
      try {
        const res = await fetch("/api/b2b/b2c/storefronts?status=active&limit=50");
        if (res.ok) {
          const data = await res.json();
          const withDomains = (data.items || []).filter(
            (sf: { domains?: string[] }) => sf.domains && sf.domains.length > 0
          );
          setStorefronts(withDomains);
        }
      } catch {
        // Silently fail — dropdown just won't show B2C options
      }
    }
    fetchStorefronts();
  }, []);

  const payment = order.payment;

  // Only show for pending/confirmed/shipped/delivered orders
  if (!["pending", "confirmed", "shipped", "delivered"].includes(order.status)) {
    return null;
  }

  // Initialize payment data if not present
  const paymentStatus = payment?.payment_status || "awaiting";
  const amountDue = payment?.amount_due || order.order_total;
  const payments = payment?.payments || [];

  // Calculate pending and confirmed amounts from payments
  const pendingAmount = payments
    .filter((p) => !p.confirmed)
    .reduce((sum, p) => sum + p.amount, 0);
  const confirmedAmount = payments
    .filter((p) => p.confirmed)
    .reduce((sum, p) => sum + p.amount, 0);

  // Remaining is based on confirmed payments only.
  // Account for fully refunded gateway transactions whose payment records
  // haven't been removed from the order yet (stale data).
  const staleRefundedAmount = gatewayTransactions
    .filter((t) => t.status === "refunded")
    .filter((t) => payments.some((p) => p.reference === t.transaction_id))
    .reduce((sum, t) => sum + t.gross_amount, 0);
  const effectiveConfirmed = Math.max(0, confirmedAmount - staleRefundedAmount);
  const remainingAfterConfirmed = amountDue - effectiveConfirmed;

  // Gateway-aware remaining: also account for completed/captured gateway
  // transactions that may not yet have a corresponding manual payment record.
  const gatewayPaidAmount = gatewayTransactions
    .filter((t) => t.status === "completed" || t.status === "captured")
    .reduce((sum, t) => sum + t.gross_amount, 0);
  const gatewayProcessingAmount = gatewayTransactions
    .filter((t) => t.status === "processing" || t.status === "pending" || t.status === "authorized")
    .reduce((sum, t) => sum + t.gross_amount, 0);
  // True remaining considers the higher of confirmed manual payments vs gateway completed
  // to avoid double-counting when both exist for the same transaction.
  const effectivePaid = Math.max(effectiveConfirmed, gatewayPaidAmount);
  const trueRemaining = Math.max(0, amountDue - effectivePaid);

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

  // Payment progress percentage (accounts for refunds)
  const progressPct = amountDue > 0 ? Math.min((effectiveConfirmed / amountDue) * 100, 100) : 0;

  // Format date for datetime-local input
  const formatDateForInput = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  // Handle add payment
  const handleAddPayment = async () => {
    const parsedAmount = parseDecimalValue(newPayment.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
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
        setNewPayment({ amount: "", method: allowedMethods[0] || "bank_transfer", reference: "", notes: "", confirmed: false, recorded_at: "" });
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

    const parsedAmount = parseDecimalValue(editingPayment.amount);
    if (!parsedAmount || parsedAmount <= 0) {
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
          amount: parsedAmount,
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

  // Generate a PayPal payment link to share with the customer
  const handleGeneratePaymentLink = async () => {
    // Block only if there's nothing left to pay (gateway-aware)
    if (trueRemaining <= 0) {
      toast.error("L'ordine è già stato pagato.");
      return;
    }

    // Warn if there are pending/processing gateway transactions
    if (gatewayProcessingAmount > 0) {
      setProcessingConfirmOpen(true);
      return;
    }

    await doGeneratePaymentLink();
  };

  const doGeneratePaymentLink = async () => {
    // Parse custom amount or default to true remaining
    const parsedAmount = linkAmount
      ? (parseDecimalValue(linkAmount) ?? 0)
      : trueRemaining;

    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Inserisci un importo valido.");
      return;
    }
    if (parsedAmount > trueRemaining) {
      toast.error(`L'importo non può superare il rimanente (${formatCurrency(trueRemaining)}).`);
      return;
    }

    setIsGeneratingLink(true);
    setPaymentLink(null);
    try {
      const tenantId = tenantPrefix.replace(/^\//, "");
      const payAmount = parsedAmount;

      // Build return URL and metadata based on destination
      let returnUrl: string;
      let brandName: string | undefined;
      const selectedStorefront =
        selectedDestination !== "generic"
          ? storefronts.find((sf) => sf.slug === selectedDestination)
          : null;

      if (selectedStorefront && selectedStorefront.domains[0]) {
        // B2C storefront: PayPal returns directly to B2C payment-success page
        // PayPal will append &token={paypal-order-id} — B2C uses token + tenant to capture via public API
        const rawDomain = typeof selectedStorefront.domains[0] === "string"
          ? selectedStorefront.domains[0]
          : selectedStorefront.domains[0].domain;
        const domain = rawDomain?.replace(/\/+$/, "") || "";
        returnUrl = `${domain}/pages/payment-success?paymentgateway=paypal&order_id=${encodeURIComponent(order.order_id)}&tenant=${encodeURIComponent(tenantId)}`;
        brandName = selectedStorefront.branding?.title || selectedStorefront.name;
      } else {
        // Generic: PayPal returns to B2B /pay/complete
        returnUrl = `${window.location.origin}/pay/complete?tenant=${encodeURIComponent(tenantId)}`;
      }

      const res = await fetch("/api/b2b/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          amount: payAmount,
          currency: "EUR",
          provider: "paypal",
          return_url: returnUrl,
          metadata: {
            payment_number: undefined, // will be set by server
            description: `Ordine ${order.order_id}`,
            brand_name: brandName,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.redirect_url) {
        setPaymentLink(data.redirect_url);
        toast.success("Link di pagamento generato");
        fetchGatewayTransactions(); // refresh list
      } else {
        toast.error(data.error || "Errore nella generazione del link");
      }
    } catch {
      toast.error("Errore di rete");
    } finally {
      setIsGeneratingLink(false);
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
              {formatCurrency(effectiveConfirmed)}
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
                                  const normalized = normalizeDecimalInput(e.target.value);
                                  if (normalized === null) return;
                                  setEditingPayment({ ...editingPayment, amount: normalized });
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
                                {getAllowedManualMethods(order.allowed_payment_methods).map((m) => (
                                  <option key={m} value={m}>
                                    {PAYMENT_METHOD_IT[m]}
                                  </option>
                                ))}
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
                        (() => {
                          const isRefundedGateway = p.reference && gatewayTransactions.some(
                            (t) => t.transaction_id === p.reference && (t.status === "refunded" || t.status === "partial_refund")
                          );
                          return <>
                          <div className="flex justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isRefundedGateway ? "line-through text-muted-foreground" : ""}`}>
                                {PAYMENT_METHOD_IT[p.method] || p.method.replace(/_/g, " ")}
                              </span>
                              {isRefundedGateway ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                  <XCircle className="h-2.5 w-2.5" />
                                  Rimborsato
                                </span>
                              ) : p.confirmed ? (
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
                              <span className={`font-semibold ${isRefundedGateway ? "line-through text-muted-foreground" : "text-emerald-600"}`}>
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
                        </>;
                        })()
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
                    const normalized = normalizeDecimalInput(e.target.value);
                    if (normalized === null) return;
                    setNewPayment({ ...newPayment, amount: normalized });
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
                  {getAllowedManualMethods(order.allowed_payment_methods).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_IT[m]}
                    </option>
                  ))}
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
            <div className="space-y-2">
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

              {/* Payment link section — only if there's a true remaining after gateway */}
              {trueRemaining > 0 ? (
                <>
                  {/* Warning about processing transactions */}
                  {gatewayProcessingAmount > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        {formatCurrency(gatewayProcessingAmount)} in transazioni gateway in elaborazione.
                      </span>
                    </div>
                  )}

                  {/* Payment destination selector */}
                  {storefronts.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Destinazione dopo il pagamento
                      </label>
                      <select
                        value={selectedDestination}
                        onChange={(e) => setSelectedDestination(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                      >
                        <option value="generic">Pagina generica (VINC Commerce)</option>
                        {storefronts.map((sf) => (
                          <option key={sf.slug} value={sf.slug}>
                            {sf.branding?.title || sf.name} ({(typeof sf.domains[0] === "string" ? sf.domains[0] : sf.domains[0]?.domain)?.replace(/^https?:\/\//, "")})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Payment link amount */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Importo link di pagamento
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={linkAmount}
                      onChange={(e) => {
                        const normalized = normalizeDecimalInput(e.target.value);
                        if (normalized === null) return;
                        setLinkAmount(normalized);
                      }}
                      placeholder={trueRemaining.toFixed(2).replace(".", ",")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  {/* Generate PayPal Payment Link */}
                  <button
                    onClick={handleGeneratePaymentLink}
                    disabled={isGeneratingLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0070ba] text-white text-sm font-medium hover:bg-[#005c99] transition disabled:opacity-50"
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Genera Link Pagamento PayPal
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Pagamento completato tramite gateway.</span>
                </div>
              )}
            </div>
          )
        )}

        {/* Payment Link Display */}
        {paymentLink && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
            <p className="text-xs font-medium text-blue-800">Link di pagamento generato:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={paymentLink}
                className="flex-1 text-xs font-mono bg-white border border-blue-200 rounded px-2 py-1.5 text-blue-900 truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(paymentLink);
                  toast.success("Link copiato!");
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition whitespace-nowrap"
              >
                Copia
              </button>
            </div>
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              Apri in PayPal <ArrowRight className="h-3 w-3" />
            </a>
          </div>
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

      {/* Confirm generating link when gateway transactions are processing */}
      <ConfirmDialog
        open={processingConfirmOpen}
        title="Transazioni in Elaborazione"
        message={`Ci sono transazioni gateway in elaborazione per ${formatCurrency(gatewayProcessingAmount)}. Vuoi comunque generare un nuovo link di pagamento?`}
        confirmText="Genera Link"
        cancelText="Annulla"
        variant="warning"
        onConfirm={() => {
          setProcessingConfirmOpen(false);
          doGeneratePaymentLink();
        }}
        onCancel={() => setProcessingConfirmOpen(false)}
      />
    </div>
  );
}

