"use client";

import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/document";
import type { DocumentStatus } from "@/lib/constants/document";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  finalized: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  voided: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

interface Props {
  status: DocumentStatus;
}

export function DocumentStatusBadge({ status }: Props) {
  const label = DOCUMENT_STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
