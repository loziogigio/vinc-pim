"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Receipt,
  Banknote,
  Percent,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { TransactionStatusBadge, ProviderBadge } from "@/components/payments";
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants/payment";
import type {
  TransactionStatus,
  PaymentProvider,
  PaymentType,
  PaymentMethod,
} from "@/lib/constants/payment";

interface PaymentEvent {
  event_type: string;
  status: string;
  timestamp: string;
  provider_event_id?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionDetail {
  transaction_id: string;
  tenant_id: string;
  order_id?: string;
  provider: PaymentProvider;
  provider_payment_id: string;
  payment_type: PaymentType;
  gross_amount: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  status: TransactionStatus;
  method?: PaymentMethod;
  customer_id?: string;
  customer_email?: string;
  failure_reason?: string;
  failure_code?: string;
  events: PaymentEvent[];
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

const formatCurrency = (amount: number, currency: string = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export default function TransactionDetailPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // Extract ID from pathname
  const transactionId = pathname?.split("/transactions/")[1] || "";

  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Refund state
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const loadTransaction = useCallback(async () => {
    if (!transactionId) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/b2b/payments/transactions/${transactionId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Transazione non trovata" : "Errore nel caricamento");
        return;
      }
      const data = await res.json();
      setTransaction(data.transaction || null);
    } catch {
      setError("Errore di rete");
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  const handleRefund = async () => {
    if (!transaction) return;
    setIsRefunding(true);
    setRefundResult(null);

    const body: Record<string, unknown> = {
      transaction_id: transaction.transaction_id,
    };
    const amt = parseFloat(refundAmount.replace(",", "."));
    if (!isNaN(amt) && amt > 0 && amt < transaction.gross_amount) {
      body.amount = amt;
    }

    try {
      const res = await fetch("/api/b2b/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setRefundResult({
          success: true,
          message: `Rimborso eseguito: ${formatCurrency(data.amount || transaction.gross_amount, transaction.currency)}`,
        });
        setShowRefund(false);
        setRefundAmount("");
        loadTransaction();
      } else {
        setRefundResult({ success: false, message: data.error || "Rimborso fallito" });
      }
    } catch {
      setRefundResult({ success: false, message: "Errore di rete" });
    } finally {
      setIsRefunding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="p-6">
        <Link
          href={`${tenantPrefix}/b2b/payments/transactions`}
          className="inline-flex items-center gap-1.5 text-sm text-[#009688] hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Torna alle transazioni
        </Link>
        <div className="p-12 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p>{error || "Transazione non trovata"}</p>
        </div>
      </div>
    );
  }

  const canRefund = ["completed", "captured"].includes(transaction.status);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`${tenantPrefix}/b2b/payments/transactions`}
            className="inline-flex items-center gap-1.5 text-sm text-[#009688] hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Transazioni
          </Link>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            Transazione
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-0.5">
            {transaction.transaction_id}
          </p>
        </div>
        <TransactionStatusBadge status={transaction.status} />
      </div>

      {/* Refund result banner */}
      {refundResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            refundResult.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {refundResult.success ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {refundResult.message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Importo Lordo"
          value={formatCurrency(transaction.gross_amount, transaction.currency)}
          icon={Banknote}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          label="Commissione"
          value={formatCurrency(transaction.commission_amount, transaction.currency)}
          icon={Percent}
          color="bg-amber-50 text-amber-600"
          sub={`${(transaction.commission_rate * 100).toFixed(1)}%`}
        />
        <SummaryCard
          label="Netto"
          value={formatCurrency(transaction.net_amount, transaction.currency)}
          icon={Receipt}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          label="Metodo"
          value={
            transaction.method
              ? PAYMENT_METHOD_LABELS[transaction.method]
              : "—"
          }
          icon={CreditCard}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Details Grid + Refund */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#ebe9f1]">
          <div className="px-4 py-3 border-b border-[#ebe9f1]">
            <h2 className="font-medium text-[#5e5873]">Dettagli</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 text-sm">
            <DetailRow label="Provider">
              <ProviderBadge provider={transaction.provider} />
            </DetailRow>
            <DetailRow label="Tipo">
              {PAYMENT_TYPE_LABELS[transaction.payment_type]}
            </DetailRow>
            <DetailRow label="Order ID">
              {transaction.order_id || "—"}
            </DetailRow>
            <DetailRow label="Cliente">
              {transaction.customer_email || transaction.customer_id || "—"}
            </DetailRow>
            <DetailRow label="Provider Payment ID">
              <span className="font-mono text-xs">
                {transaction.provider_payment_id}
              </span>
            </DetailRow>
            <DetailRow label="Idempotency Key">
              <span className="font-mono text-xs">
                {transaction.idempotency_key || "—"}
              </span>
            </DetailRow>
            <DetailRow label="Creato il">
              {formatDateTime(transaction.created_at)}
            </DetailRow>
            <DetailRow label="Aggiornato il">
              {formatDateTime(transaction.updated_at)}
            </DetailRow>
            {transaction.completed_at && (
              <DetailRow label="Completato il">
                {formatDateTime(transaction.completed_at)}
              </DetailRow>
            )}
            {transaction.failure_reason && (
              <div className="col-span-2">
                <DetailRow label="Errore">
                  <span className="text-red-600">
                    {transaction.failure_reason}
                    {transaction.failure_code && ` (${transaction.failure_code})`}
                  </span>
                </DetailRow>
              </div>
            )}
          </div>
        </div>

        {/* Refund Action */}
        <div className="bg-white rounded-lg border border-[#ebe9f1]">
          <div className="px-4 py-3 border-b border-[#ebe9f1]">
            <h2 className="font-medium text-[#5e5873]">Azioni</h2>
          </div>
          <div className="p-4">
            {canRefund ? (
              <>
                {!showRefund ? (
                  <button
                    onClick={() => setShowRefund(true)}
                    className="w-full px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    Rimborsa Transazione
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5e5873] mb-1">
                        Importo (vuoto = rimborso totale)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={String(transaction.gross_amount)}
                        value={refundAmount}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
                            setRefundAmount(v);
                          }
                        }}
                        className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRefund}
                        disabled={isRefunding}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isRefunding ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          "Conferma"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRefund(false);
                          setRefundAmount("");
                        }}
                        className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8] transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nessuna azione disponibile per lo stato corrente.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="px-4 py-3 border-b border-[#ebe9f1]">
          <h2 className="font-medium text-[#5e5873]">Cronologia Eventi</h2>
        </div>
        {transaction.events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Nessun evento registrato</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="relative pl-6 space-y-4">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#ebe9f1]" />

              {transaction.events.map((event, i) => (
                <div key={i} className="relative flex gap-3">
                  <div className="absolute left-[-15px] top-1.5 w-2 h-2 rounded-full bg-[#009688] ring-2 ring-white" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#5e5873]">
                        {event.event_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Stato: {event.status}
                      </span>
                      {event.provider_event_id && (
                        <span className="text-xs font-mono text-muted-foreground">
                          ({event.provider_event_id})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-bold text-[#5e5873]">{value}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && (
              <span className="text-xs text-muted-foreground">({sub})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-[#5e5873]">{children}</div>
    </div>
  );
}
