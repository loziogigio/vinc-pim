"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Download } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ReservationFilters } from "@/components/bookings/ReservationFilters";
import { ReservationsTable } from "@/components/bookings/ReservationsTable";
import type { BookingStatus } from "@/lib/constants/booking";

interface Booking {
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

interface Filters {
  status: string;
  dateFrom: string;
  dateTo: string;
  customerId: string;
}

export default function ReservationsPage() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    dateFrom: "",
    dateTo: "",
    customerId: "",
  });

  const limit = 20;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    if (filters.customerId) params.set("customer_id", filters.customerId);
    return params.toString();
  }, [page, filters]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/bookings?${queryString}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBookings(data.data?.bookings || []);
          setTotal(data.data?.total || 0);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [queryString]);

  const updateFilter = useCallback((updates: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: "", dateFrom: "", dateTo: "", customerId: "" });
    setPage(1);
  }, []);

  const hasActiveFilters = filters.status !== "" || filters.dateFrom !== "" || filters.dateTo !== "" || filters.customerId !== "";

  const exportCsv = useCallback(() => {
    if (bookings.length === 0) return;
    const headers = ["Booking ID", "Departure", "Customer", "Resource", "Qty", "Total", "Status", "Created"];
    const rows = bookings.map((b) => [
      b.booking_id,
      b.departure_label,
      b.customer_id,
      b.child_entity_code,
      String(b.quantity),
      String(b.total_price),
      b.status,
      b.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bookings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873] flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            {t("pages.bookings.reservations.title")}
          </h1>
          <p className="text-[#b9b9c3] mt-1">
            {t("pages.bookings.reservations.subtitle")}
          </p>
        </div>
        {bookings.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#6e6b7b] hover:bg-[#fafafc] transition"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        )}
      </div>

      <ReservationFilters
        status={filters.status}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        customerId={filters.customerId}
        onStatusChange={(status) => updateFilter({ status })}
        onDateFromChange={(dateFrom) => updateFilter({ dateFrom })}
        onDateToChange={(dateTo) => updateFilter({ dateTo })}
        onCustomerIdChange={(customerId) => updateFilter({ customerId })}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <ReservationsTable
        bookings={bookings}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
