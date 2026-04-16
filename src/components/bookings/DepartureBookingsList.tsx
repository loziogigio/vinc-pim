"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { BookingStatus } from "@/lib/constants/booking";

interface BookingRow {
  booking_id: string;
  customer_id: string;
  child_entity_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  status: BookingStatus;
  created_at: string;
}

interface DepartureBookingsListProps {
  bookings: BookingRow[];
  isLoading: boolean;
  onConfirm: (bookingId: string) => void;
  onCancel: (bookingId: string) => void;
}

const currencyFormat = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function DepartureBookingsList({
  bookings,
  isLoading,
  onConfirm,
  onCancel,
}: DepartureBookingsListProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#b9b9c3] animate-pulse">
        {t("common.loading") || "Loading..."}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[#b9b9c3]">{t("pages.bookings.departureDetail.noBookings")}</p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#ebe9f1] bg-[#fafafc]">
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.bookingId")}</th>
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.customer")}</th>
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.resource")}</th>
          <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.quantity")}</th>
          <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.totalPrice")}</th>
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.status")}</th>
          <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#5e5873] uppercase">{t("pages.bookings.reservations.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.booking_id} className="border-b border-[#ebe9f1] last:border-0 hover:bg-[#fafafc] transition">
            <td className="px-4 py-2.5 text-sm font-mono text-[#5e5873]">{b.booking_id}</td>
            <td className="px-4 py-2.5 text-sm text-[#6e6b7b]">{b.customer_id}</td>
            <td className="px-4 py-2.5 text-xs text-[#b9b9c3]">{b.child_entity_code}</td>
            <td className="px-4 py-2.5 text-sm text-[#5e5873] text-right">{b.quantity}</td>
            <td className="px-4 py-2.5 text-sm font-medium text-[#5e5873] text-right">{currencyFormat.format(b.total_price)}</td>
            <td className="px-4 py-2.5"><BookingStatusBadge status={b.status} /></td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1">
                {b.status === "held" && (
                  <button onClick={() => onConfirm(b.booking_id)} className="px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition">
                    {t("pages.bookings.reservations.confirm")}
                  </button>
                )}
                {(b.status === "held" || b.status === "confirmed") && (
                  <button onClick={() => onCancel(b.booking_id)} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition">
                    {t("pages.bookings.reservations.cancel")}
                  </button>
                )}
                <Link
                  href={`${tenantPrefix}/b2b/bookings/reservations/${b.booking_id}`}
                  className="p-1 text-[#009688] hover:bg-[rgba(0,150,136,0.08)] rounded transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
