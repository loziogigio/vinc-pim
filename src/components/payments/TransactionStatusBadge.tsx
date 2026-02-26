"use client";

import { TRANSACTION_STATUS_LABELS } from "@/lib/constants/payment";
import type { TransactionStatus } from "@/lib/constants/payment";

const STATUS_COLORS: Record<TransactionStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  authorized: "bg-indigo-100 text-indigo-700",
  captured: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
  refunded: "bg-purple-100 text-purple-700",
  partial_refund: "bg-orange-100 text-orange-700",
};

interface Props {
  status: TransactionStatus;
}

export function TransactionStatusBadge({ status }: Props) {
  const label = TRANSACTION_STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
