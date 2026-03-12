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
  ExternalLink,
} from "lucide-react";
import { TransactionStatusBadge, ProviderBadge } from "@/components/payments";
import { normalizeDecimalInput, parseDecimalValue } from "@/lib/utils/decimal-input";
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
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PaymentEvent {
  event_type: string;
  status: string;
  timestamp: string;
  provider_event_id?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionDetail {
  transaction_id: string;
  payment_number?: string;
  tenant_id: string;
  order_id?: string;
  provider: PaymentProvider;
  provider_payment_id: string;
  provider_capture_id?: string;
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
  const { t } = useTranslation();
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
        setError(res.status === 404 ? t("pages.payments.transactionDetail.notFound") : t("pages.payments.transactionDetail.loadError"));
        return;
      }
      const data = await res.json();
      setTransaction(data.transaction || null);
    } catch {
      setError(t("pages.payments.transactionDetail.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, t]);

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
    const amt = parseDecimalValue(refundAmount);
    if (amt !== undefined && amt > 0 && amt < transaction.gross_amount) {
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
          message: t("pages.payments.transactionDetail.refundSuccess", { amount: formatCurrency(data.amount || transaction.gross_amount, transaction.currency) }),
        });
        setShowRefund(false);
        setRefundAmount("");
        loadTransaction();
      } else {
        setRefundResult({ success: false, message: data.error || t("pages.payments.transactionDetail.refundFailed") });
      }
    } catch {
      setRefundResult({ success: false, message: t("pages.payments.transactionDetail.networkError") });
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
          <ArrowLeft className="w-4 h-4" /> {t("pages.payments.transactionDetail.backToTransactions")}
        </Link>
        <div className="p-12 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p>{error || t("pages.payments.transactionDetail.notFound")}</p>
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
            <ArrowLeft className="w-4 h-4" /> {t("pages.payments.transactionDetail.transactions")}
          </Link>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            {transaction.payment_number || t("pages.payments.transactionDetail.transaction")}
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
          label={t("pages.payments.transactionDetail.grossAmount")}
          value={formatCurrency(transaction.gross_amount, transaction.currency)}
          icon={Banknote}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          label={t("pages.payments.transactionDetail.commission")}
          value={formatCurrency(transaction.commission_amount, transaction.currency)}
          icon={Percent}
          color="bg-amber-50 text-amber-600"
          sub={`${(transaction.commission_rate * 100).toFixed(1)}%`}
        />
        <SummaryCard
          label={t("pages.payments.transactionDetail.net")}
          value={formatCurrency(transaction.net_amount, transaction.currency)}
          icon={Receipt}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          label={t("pages.payments.transactionDetail.method")}
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
            <h2 className="font-medium text-[#5e5873]">{t("pages.payments.transactionDetail.details")}</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 text-sm">
            <DetailRow label={t("pages.payments.transactionDetail.provider")}>
              <ProviderBadge provider={transaction.provider} />
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.type")}>
              {PAYMENT_TYPE_LABELS[transaction.payment_type]}
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.orderId")}>
              {transaction.order_id ? (
                <Link
                  href={`${tenantPrefix}/b2b/store/orders/${transaction.order_id}`}
                  className="inline-flex items-center gap-1 text-[#009688] hover:underline"
                >
                  {transaction.order_id}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.customer")}>
              {transaction.customer_email || transaction.customer_id || "—"}
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.providerOrderId")}>
              <span className="font-mono text-xs">
                {transaction.provider_payment_id || "—"}
              </span>
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.providerCaptureId")}>
              <span className="font-mono text-xs">
                {transaction.provider_capture_id || "—"}
              </span>
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.idempotencyKey")}>
              <span className="font-mono text-xs">
                {transaction.idempotency_key || "—"}
              </span>
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.createdAt")}>
              {formatDateTime(transaction.created_at)}
            </DetailRow>
            <DetailRow label={t("pages.payments.transactionDetail.updatedAt")}>
              {formatDateTime(transaction.updated_at)}
            </DetailRow>
            {transaction.completed_at && (
              <DetailRow label={t("pages.payments.transactionDetail.completedAt")}>
                {formatDateTime(transaction.completed_at)}
              </DetailRow>
            )}
            {transaction.failure_reason && (
              <div className="col-span-2">
                <DetailRow label={t("pages.payments.transactionDetail.error")}>
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
            <h2 className="font-medium text-[#5e5873]">{t("pages.payments.transactionDetail.actions")}</h2>
          </div>
          <div className="p-4">
            {canRefund ? (
              <>
                {!showRefund ? (
                  <button
                    onClick={() => setShowRefund(true)}
                    className="w-full px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    {t("pages.payments.transactionDetail.refundTransaction")}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#5e5873] mb-1">
                        {t("pages.payments.transactionDetail.refundAmountLabel")}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={String(transaction.gross_amount)}
                        value={refundAmount}
                        onChange={(e) => {
                          const normalized = normalizeDecimalInput(e.target.value);
                          if (normalized === null) return;
                          setRefundAmount(normalized);
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
                          t("common.confirm")
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRefund(false);
                          setRefundAmount("");
                        }}
                        className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8] transition-colors"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {t("pages.payments.transactionDetail.noActionsAvailable")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="px-4 py-3 border-b border-[#ebe9f1]">
          <h2 className="font-medium text-[#5e5873]">{t("pages.payments.transactionDetail.eventTimeline")}</h2>
        </div>
        {transaction.events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{t("pages.payments.transactionDetail.noEvents")}</p>
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
                        {t("pages.payments.transactionDetail.eventStatus", { status: event.status })}
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
