"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ship, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { DepartureFilters } from "@/components/bookings/DepartureFilters";
import { DepartureViewToggle } from "@/components/bookings/DepartureViewToggle";
import { DeparturesTable } from "@/components/bookings/DeparturesTable";
import { DeparturesCalendar } from "@/components/bookings/DeparturesCalendar";
import { CreateDepartureModal } from "@/components/bookings/CreateDepartureModal";
import type { DepartureStatus } from "@/lib/constants/booking";

interface DepartureResource {
  resource_id: string;
  resource_type: string;
  child_entity_code: string;
  total_capacity: number;
  available: number;
  held: number;
  booked: number;
}

interface Departure {
  departure_id: string;
  label: string;
  product_entity_code: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
  resources: DepartureResource[];
}

interface Filters {
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function DeparturesPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<"calendar" | "list">("list");
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const limit = 20;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    return params.toString();
  }, [page, filters, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/departures?${queryString}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDepartures(data.data?.departures || []);
          setTotal(data.data?.total || 0);
        }
      } catch (error) {
        console.error("Error fetching departures:", error);
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
    setFilters({ status: "", dateFrom: "", dateTo: "" });
    setPage(1);
  }, []);

  const hasActiveFilters = filters.status !== "" || filters.dateFrom !== "" || filters.dateTo !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873] flex items-center gap-2">
            <Ship className="h-6 w-6" />
            {t("pages.bookings.departures.title")}
          </h1>
          <p className="text-[#b9b9c3] mt-1">
            {t("pages.bookings.departures.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-[0.428rem] bg-[#009688] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#00796b] transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t("pages.bookings.departures.newDeparture")}
        </button>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DepartureFilters
          status={filters.status}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onStatusChange={(status) => updateFilter({ status })}
          onDateFromChange={(dateFrom) => updateFilter({ dateFrom })}
          onDateToChange={(dateTo) => updateFilter({ dateTo })}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <DepartureViewToggle view={view} onViewChange={setView} />
      </div>

      {/* Content */}
      {view === "list" ? (
        <DeparturesTable
          departures={departures}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      ) : (
        <DeparturesCalendar statusFilter={filters.status} />
      )}

      <CreateDepartureModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
