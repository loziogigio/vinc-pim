"use client";

import { Calendar, Clock, Ship } from "lucide-react";
import { DepartureStatusBadge } from "./DepartureStatusBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { DEPARTURE_STATUSES, type DepartureStatus } from "@/lib/constants/booking";

interface DepartureHeaderProps {
  label: string;
  status: DepartureStatus;
  productEntityCode: string;
  startsAt: string;
  endsAt?: string;
  bookingCutoffAt?: string;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function DepartureHeader({
  label,
  status,
  productEntityCode,
  startsAt,
  endsAt,
  bookingCutoffAt,
  onStatusChange,
  onDelete,
  canDelete,
}: DepartureHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#5e5873] flex items-center gap-2">
            <Ship className="h-5 w-5 text-[#009688]" />
            {label}
          </h1>
          <p className="text-sm text-[#b9b9c3] mt-1">{productEntityCode}</p>
          <div className="flex items-center gap-4 mt-3">
            <DepartureStatusBadge status={status} size="md" />
            <span className="flex items-center gap-1.5 text-sm text-[#6e6b7b]">
              <Calendar className="h-3.5 w-3.5" />
              {dateFormat.format(new Date(startsAt))}
              {endsAt && ` — ${dateFormat.format(new Date(endsAt))}`}
            </span>
            {bookingCutoffAt && (
              <span className="flex items-center gap-1.5 text-sm text-[#b9b9c3]">
                <Clock className="h-3.5 w-3.5" />
                {t("pages.bookings.departures.cutoffDate")}: {dateFormat.format(new Date(bookingCutoffAt))}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status change dropdown */}
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
          >
            {DEPARTURE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`pages.bookings.statuses.departure.${s}`)}
              </option>
            ))}
          </select>

          {canDelete && (
            <button
              onClick={onDelete}
              className="rounded-[0.358rem] border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              {t("pages.bookings.departureDetail.deleteDeparture")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
