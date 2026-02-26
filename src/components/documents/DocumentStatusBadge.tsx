"use client";

import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/document";
import type { DocumentStatus } from "@/lib/constants/document";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  finalized: "bg-blue-100 text-blue-700",
  sent: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  voided: "bg-red-100 text-red-700",
};

interface Props {
  status: DocumentStatus;
}

export function DocumentStatusBadge({ status }: Props) {
  const label = DOCUMENT_STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
