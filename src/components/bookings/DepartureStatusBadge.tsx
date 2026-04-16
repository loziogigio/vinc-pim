"use client";

import type { DepartureStatus } from "@/lib/constants/booking";
import { DEPARTURE_STATUS_LABELS } from "@/lib/constants/booking";
import { useTranslation } from "@/lib/i18n/useTranslation";

const STATUS_COLORS: Record<DepartureStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  closed: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
};

interface DepartureStatusBadgeProps {
  status: DepartureStatus;
  size?: "sm" | "md";
}

export function DepartureStatusBadge({ status, size = "sm" }: DepartureStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  const label = t(`pages.bookings.statuses.departure.${status}`) || DEPARTURE_STATUS_LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colors} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      {label}
    </span>
  );
}
