"use client";

import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  TRANSACTION_STATUS_LABELS,
  PAYMENT_PROVIDER_LABELS,
} from "@/lib/constants/payment";
import type { TransactionStatus, PaymentProvider } from "@/lib/constants/payment";

export interface GatewayTransaction {
  transaction_id: string;
  payment_number?: string;
  provider: PaymentProvider;
  gross_amount: number;
  currency: string;
  status: TransactionStatus;
  method?: string;
  created_at: string;
}

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

export function GatewayTransactionRow({
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
