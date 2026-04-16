"use client";

import { X } from "lucide-react";
import { BOOKING_STATUSES } from "@/lib/constants/booking";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ReservationFiltersProps {
  status: string;
  dateFrom: string;
  dateTo: string;
  customerId: string;
  onStatusChange: (status: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onCustomerIdChange: (id: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function ReservationFilters({
  status,
  dateFrom,
  dateTo,
  customerId,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onCustomerIdChange,
  onClear,
  hasActiveFilters,
}: ReservationFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
      >
        <option value="">{t("pages.bookings.reservations.allStatuses")}</option>
        {BOOKING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`pages.bookings.statuses.booking.${s}`)}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={customerId}
        onChange={(e) => onCustomerIdChange(e.target.value)}
        placeholder={t("pages.bookings.reservations.filterByCustomer")}
        className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] placeholder:text-[#d5d5dc] focus:border-[#009688] focus:outline-none w-40"
      />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#b9b9c3]">{t("pages.bookings.filters.dateFrom")}</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#b9b9c3]">{t("pages.bookings.filters.dateTo")}</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
        />
      </div>

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
