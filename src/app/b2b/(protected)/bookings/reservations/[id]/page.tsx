"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import {
  Calendar,
  User,
  Package,
  CreditCard,
  CheckCircle,
  XCircle,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BookingStatusBadge } from "@/components/bookings/BookingStatusBadge";
import { HoldExpiryCountdown } from "@/components/bookings/HoldExpiryCountdown";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { getAllowedBookingTransitions, type BookingStatus } from "@/lib/constants/booking";

interface Booking {
  booking_id: string;
  departure_id: string;
  departure_label: string;
  resource_id: string;
  child_entity_code: string;
  customer_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  status: BookingStatus;
  starts_at: string;
  hold_expires_at?: string;
  confirmed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
}

const currencyFormat = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ReservationDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/bookings/${bookingId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBooking(data.data || null);
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bookingId]);

  const performAction = useCallback(async (action: string, body?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/b2b/bookings/${bookingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setBooking(data.data);
      }
    } catch (error) {
      console.error(`Error ${action} booking:`, error);
    } finally {
      setActionLoading(false);
    }
  }, [bookingId]);

  if (isLoading || !booking) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const allowedTransitions = getAllowedBookingTransitions(booking.status, "admin");

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.bookings.reservations.title"), href: `${tenantPrefix}/b2b/bookings/reservations` },
          { label: booking.booking_id },
        ]}
      />

      {/* Header */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#5e5873]">{t("pages.bookings.reservationDetail.title")}</h1>
            <p className="text-sm font-mono text-[#b9b9c3] mt-1">{booking.booking_id}</p>
            <div className="mt-3 flex items-center gap-3">
              <BookingStatusBadge status={booking.status} size="md" />
              {booking.status === "held" && booking.hold_expires_at && (
                <HoldExpiryCountdown expiresAt={booking.hold_expires_at} />
              )}
            </div>
          </div>
          <div className="text-right text-sm text-[#b9b9c3]">
            {t("pages.bookings.reservations.created")}: {dateFormat.format(new Date(booking.created_at))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Info cards */}
        <div className="space-y-4">
          {/* Departure info */}
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-[#009688]" />
              {t("pages.bookings.reservationDetail.departureInfo")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.departure")}</span>
                <span className="text-[#5e5873] font-medium">{booking.departure_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.departures.startsAt")}</span>
                <span className="text-[#5e5873]">{dateFormat.format(new Date(booking.starts_at))}</span>
              </div>
            </div>
          </div>

          {/* Resource & Customer info */}
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-[#009688]" />
              {t("pages.bookings.reservationDetail.resourceInfo")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.resource")}</span>
                <span className="text-[#5e5873] font-mono text-xs">{booking.child_entity_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.customer")}</span>
                <span className="text-[#5e5873]">{booking.customer_id}</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-[#009688]" />
              {t("pages.bookings.reservationDetail.pricing")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.unitPrice")}</span>
                <span className="text-[#5e5873]">{currencyFormat.format(booking.unit_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.quantity")}</span>
                <span className="text-[#5e5873]">{booking.quantity}</span>
              </div>
              <div className="flex justify-between border-t border-[#ebe9f1] pt-2">
                <span className="text-[#5e5873] font-semibold">{t("pages.bookings.reservations.totalPrice")}</span>
                <span className="text-[#5e5873] font-bold text-base">{currencyFormat.format(booking.total_price)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions & Audit */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] mb-4">
              {t("pages.bookings.reservationDetail.statusActions")}
            </h3>
            <div className="space-y-3">
              {allowedTransitions.includes("confirmed") && (
                <button
                  onClick={() => performAction("confirm")}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-[0.428rem] bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t("pages.bookings.reservationDetail.confirmBooking")}
                </button>
              )}

              {allowedTransitions.includes("checked_in") && (
                <button
                  onClick={() => performAction("check-in")}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-[0.428rem] bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  {t("pages.bookings.reservationDetail.checkIn")}
                </button>
              )}

              {allowedTransitions.includes("no_show") && (
                <button
                  onClick={() => performAction("no-show")}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-[0.428rem] border border-purple-300 px-4 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 transition disabled:opacity-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {t("pages.bookings.reservationDetail.noShow")}
                </button>
              )}

              {allowedTransitions.includes("cancelled") && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t("pages.bookings.reservationDetail.cancelReasonPlaceholder")}
                    className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] placeholder:text-[#d5d5dc] focus:border-red-300 focus:outline-none"
                  />
                  <button
                    onClick={() => performAction("cancel", { cancelled_by: "admin", reason: cancelReason })}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-[0.428rem] border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {t("pages.bookings.reservationDetail.cancelBooking")}
                  </button>
                </div>
              )}

              {allowedTransitions.length === 0 && (
                <p className="text-sm text-[#b9b9c3] text-center py-2">
                  {t("pages.bookings.reservationDetail.title")} — {booking.status}
                </p>
              )}
            </div>
          </div>

          {/* Audit trail */}
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] mb-3">
              {t("pages.bookings.reservationDetail.auditTrail")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b9b9c3]">{t("pages.bookings.reservations.created")}</span>
                <span className="text-[#5e5873]">{dateFormat.format(new Date(booking.created_at))}</span>
              </div>
              {booking.confirmed_at && (
                <div className="flex justify-between">
                  <span className="text-[#b9b9c3]">{t("pages.bookings.reservationDetail.confirmedAt")}</span>
                  <span className="text-emerald-600">{dateFormat.format(new Date(booking.confirmed_at))}</span>
                </div>
              )}
              {booking.cancelled_at && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#b9b9c3]">{t("pages.bookings.reservationDetail.cancelledAt")}</span>
                    <span className="text-red-600">{dateFormat.format(new Date(booking.cancelled_at))}</span>
                  </div>
                  {booking.cancelled_by && (
                    <div className="flex justify-between">
                      <span className="text-[#b9b9c3]">{t("pages.bookings.reservationDetail.cancelledBy")}</span>
                      <span className="text-[#5e5873]">{booking.cancelled_by}</span>
                    </div>
                  )}
                  {booking.cancellation_reason && (
                    <div className="flex justify-between">
                      <span className="text-[#b9b9c3]">{t("pages.bookings.reservationDetail.cancellationReason")}</span>
                      <span className="text-[#5e5873]">{booking.cancellation_reason}</span>
                    </div>
                  )}
                </>
              )}
              {booking.hold_expires_at && booking.status === "held" && (
                <div className="flex justify-between">
                  <span className="text-[#b9b9c3]">{t("pages.bookings.reservationDetail.holdExpiresIn")}</span>
                  <span className="text-amber-600 font-medium">
                    {new Date(booking.hold_expires_at) > new Date()
                      ? `${Math.ceil((new Date(booking.hold_expires_at).getTime() - Date.now()) / 60000)} min`
                      : "Expired"
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
