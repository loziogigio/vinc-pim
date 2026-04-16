"use client";

import type { BookingStatus } from "@/lib/constants/booking";
import { BOOKING_STATUS_LABELS } from "@/lib/constants/booking";
import { useTranslation } from "@/lib/i18n/useTranslation";

const STATUS_COLORS: Record<BookingStatus, string> = {
  held: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  checked_in: "bg-teal-100 text-teal-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-700",
  no_show: "bg-purple-100 text-purple-700",
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  size?: "sm" | "md";
}

export function BookingStatusBadge({ status, size = "sm" }: BookingStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  const label = t(`pages.bookings.statuses.booking.${status}`) || BOOKING_STATUS_LABELS[status] || status;

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
