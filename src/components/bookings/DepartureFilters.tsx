"use client";

import { Search, X } from "lucide-react";
import { DEPARTURE_STATUSES } from "@/lib/constants/booking";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface DepartureFiltersProps {
  status: string;
  dateFrom: string;
  dateTo: string;
  onStatusChange: (status: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function DepartureFilters({
  status,
  dateFrom,
  dateTo,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onClear,
  hasActiveFilters,
}: DepartureFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
      >
        <option value="">{t("pages.bookings.departures.allStatuses")}</option>
        {DEPARTURE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`pages.bookings.statuses.departure.${s}`)}
          </option>
        ))}
      </select>

      {/* Date from */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#b9b9c3]">{t("pages.bookings.filters.dateFrom")}</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
        />
      </div>

      {/* Date to */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#b9b9c3]">{t("pages.bookings.filters.dateTo")}</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
        />
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-[0.358rem] px-2.5 py-2 text-xs text-[#b9b9c3] hover:text-red-500 transition"
        >
          <X className="h-3.5 w-3.5" />
          {t("pages.bookings.filters.clearFilters")}
        </button>
      )}
    </div>
  );
}
