"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { BookingStatus } from "@/lib/constants/booking";

interface BookingRow {
  booking_id: string;
  departure_label: string;
  departure_id: string;
  customer_id: string;
  child_entity_code: string;
  quantity: number;
  total_price: number;
  currency: string;
  status: BookingStatus;
  created_at: string;
}

interface ReservationsTableProps {
  bookings: BookingRow[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

const currencyFormat = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ReservationsTable({
  bookings,
  total,
  page,
  limit,
  onPageChange,
  isLoading,
}: ReservationsTableProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const totalPages = Math.ceil(total / limit);

  if (isLoading) {
    return (
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-12 text-center">
        <div className="animate-pulse text-[#b9b9c3]">{t("common.loading") || "Loading..."}</div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-12 text-center">
        <p className="text-[#5e5873] font-medium">{t("pages.bookings.reservations.noResults")}</p>
        <p className="text-sm text-[#b9b9c3] mt-1">{t("pages.bookings.reservations.noResultsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#ebe9f1] bg-[#fafafc]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.bookingId")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.departure")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.customer")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.quantity")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.totalPrice")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.status")}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.created")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("pages.bookings.reservations.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.booking_id} className="border-b border-[#ebe9f1] last:border-0 hover:bg-[#fafafc] transition">
              <td className="px-4 py-3 text-sm font-mono text-[#5e5873]">{b.booking_id}</td>
              <td className="px-4 py-3 text-sm text-[#6e6b7b] max-w-[200px] truncate">{b.departure_label}</td>
              <td className="px-4 py-3 text-sm text-[#6e6b7b]">{b.customer_id}</td>
              <td className="px-4 py-3 text-sm text-[#5e5873] text-right">{b.quantity}</td>
              <td className="px-4 py-3 text-sm font-medium text-[#5e5873] text-right">{currencyFormat.format(b.total_price)}</td>
              <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
              <td className="px-4 py-3 text-xs text-[#b9b9c3]">{dateFormat.format(new Date(b.created_at))}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`${tenantPrefix}/b2b/bookings/reservations/${b.booking_id}`}
                  className="inline-flex items-center gap-1 rounded-[0.358rem] px-2.5 py-1.5 text-xs font-medium text-[#009688] hover:bg-[rgba(0,150,136,0.08)] transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t("pages.bookings.reservations.view")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#ebe9f1] px-4 py-3">
          <span className="text-xs text-[#b9b9c3]">
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-30 transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-[#5e5873]">{page}/{totalPages}</span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-30 transition">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
