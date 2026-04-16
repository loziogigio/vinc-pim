"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { DepartureHeader } from "@/components/bookings/DepartureHeader";
import { DepartureResourceCards } from "@/components/bookings/DepartureResourceCards";
import { DepartureBookingsList } from "@/components/bookings/DepartureBookingsList";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DepartureStatus, BookingStatus, ResourceType } from "@/lib/constants/booking";

interface Resource {
  resource_id: string;
  resource_type: ResourceType;
  child_entity_code: string;
  total_capacity: number;
  available: number;
  held: number;
  booked: number;
  price_override?: number;
  currency?: string;
}

interface Departure {
  departure_id: string;
  label: string;
  product_entity_code: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
  booking_cutoff_at?: string;
  hold_ttl_ms: number;
  resources: Resource[];
  metadata?: Record<string, unknown>;
}

interface Booking {
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

export default function DepartureDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const departureId = params.id as string;

  const [departure, setDeparture] = useState<Departure | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Fetch departure
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/departures/${departureId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDeparture(data.data || null);
        }
      } catch (error) {
        console.error("Error fetching departure:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [departureId]);

  // Fetch bookings for this departure
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBookingsLoading(true);
      try {
        const res = await fetch(`/api/b2b/bookings?departure_id=${departureId}&limit=50`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBookings(data.data?.bookings || []);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        if (!cancelled) setBookingsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [departureId]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    try {
      const res = await fetch(`/api/b2b/departures/${departureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeparture(data.data);
      }
    } catch (error) {
      console.error("Error updating departure:", error);
    }
  }, [departureId]);

  const handleDelete = useCallback(async () => {
    if (!confirm(t("pages.bookings.departureDetail.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/b2b/departures/${departureId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`${tenantPrefix}/b2b/bookings/departures`);
      }
    } catch (error) {
      console.error("Error deleting departure:", error);
    }
  }, [departureId, router, tenantPrefix, t]);

  const handleConfirmBooking = useCallback(async (bookingId: string) => {
    try {
      const res = await fetch(`/api/b2b/bookings/${bookingId}/confirm`, { method: "POST" });
      if (res.ok) {
        // Refresh both departure and bookings
        const [depRes, bookRes] = await Promise.all([
          fetch(`/api/b2b/departures/${departureId}`),
          fetch(`/api/b2b/bookings?departure_id=${departureId}&limit=50`),
        ]);
        if (depRes.ok) setDeparture((await depRes.json()).data);
        if (bookRes.ok) setBookings((await bookRes.json()).data?.bookings || []);
      }
    } catch (error) {
      console.error("Error confirming booking:", error);
    }
  }, [departureId]);

  const handleCancelBooking = useCallback(async (bookingId: string) => {
    try {
      const res = await fetch(`/api/b2b/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelled_by: "admin" }),
      });
      if (res.ok) {
        const [depRes, bookRes] = await Promise.all([
          fetch(`/api/b2b/departures/${departureId}`),
          fetch(`/api/b2b/bookings?departure_id=${departureId}&limit=50`),
        ]);
        if (depRes.ok) setDeparture((await depRes.json()).data);
        if (bookRes.ok) setBookings((await bookRes.json()).data?.bookings || []);
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  }, [departureId]);

  if (isLoading || !departure) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.bookings.departures.title"), href: `${tenantPrefix}/b2b/bookings/departures` },
          { label: departure.label },
        ]}
      />

      <DepartureHeader
        label={departure.label}
        status={departure.status}
        productEntityCode={departure.product_entity_code}
        startsAt={departure.starts_at}
        endsAt={departure.ends_at}
        bookingCutoffAt={departure.booking_cutoff_at}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        canDelete={departure.status === "draft"}
      />

      {/* Resources */}
      <div>
        <h2 className="text-lg font-semibold text-[#5e5873] mb-3">
          {t("pages.bookings.departureDetail.resources")}
        </h2>
        <DepartureResourceCards resources={departure.resources} />
      </div>

      {/* Bookings */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ebe9f1]">
          <h2 className="text-lg font-semibold text-[#5e5873]">
            {t("pages.bookings.departureDetail.bookings")}
            {bookings.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[#b9b9c3]">({bookings.length})</span>
            )}
          </h2>
        </div>
        <DepartureBookingsList
          bookings={bookings}
          isLoading={bookingsLoading}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelBooking}
        />
      </div>
    </div>
  );
}
