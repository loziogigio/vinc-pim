"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DepartureStatusBadge } from "./DepartureStatusBadge";
import { CapacityBar } from "./CapacityBar";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DepartureStatus } from "@/lib/constants/booking";

interface CalendarDeparture {
  departure_id: string;
  label: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
  product_entity_code?: string;
  resources?: Array<{ total_capacity: number; available: number; held: number; booked: number }>;
}

interface DeparturesCalendarDayProps {
  departures: CalendarDeparture[];
  currentDate: Date;
  tenantPrefix: string;
  onDateChange: (date: Date) => void;
}

const dateFormat = new Intl.DateTimeFormat("default", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DeparturesCalendarDay({
  departures,
  currentDate,
  tenantPrefix,
  onDateChange,
}: DeparturesCalendarDayProps) {
  const { t } = useTranslation();

  const dateKey = currentDate.toISOString().split("T")[0];
  const dayDeps = useMemo(
    () => departures.filter((d) => d.starts_at.substring(0, 10) === dateKey),
    [departures, dateKey]
  );

  const prevDay = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  }, [currentDate, onDateChange]);

  const nextDay = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  }, [currentDate, onDateChange]);

  const goToday = useCallback(() => {
    onDateChange(new Date());
  }, [onDateChange]);

  return (
    <div className="space-y-3">
      {/* Day navigation */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={goToday} className="rounded-[0.358rem] px-3 py-1.5 text-xs font-medium text-[#009688] border border-[#009688] hover:bg-[rgba(0,150,136,0.08)] transition">
          {t("pages.bookings.departures.today")}
        </button>
        <button onClick={prevDay} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-[#5e5873] min-w-[200px] text-center capitalize">
          {dateFormat.format(currentDate)}
        </span>
        <button onClick={nextDay} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day content */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        {dayDeps.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#b9b9c3]">{t("pages.bookings.departures.noResults")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#ebe9f1]">
            {dayDeps.map((dep) => {
              const totalCap = dep.resources?.reduce((s, r) => s + r.total_capacity, 0) ?? 0;
              const booked = dep.resources?.reduce((s, r) => s + r.booked, 0) ?? 0;
              const held = dep.resources?.reduce((s, r) => s + r.held, 0) ?? 0;
              const available = dep.resources?.reduce((s, r) => s + r.available, 0) ?? 0;

              return (
                <Link
                  key={dep.departure_id}
                  href={`${tenantPrefix}/b2b/bookings/departures/${dep.departure_id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafafc] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#5e5873]">{dep.label}</div>
                    {dep.product_entity_code && (
                      <div className="text-xs text-[#b9b9c3] mt-0.5">{dep.product_entity_code}</div>
                    )}
                  </div>
                  {totalCap > 0 && (
                    <div className="w-32">
                      <CapacityBar total={totalCap} available={available} held={held} booked={booked} />
                      <div className="text-[10px] text-[#b9b9c3] text-right mt-0.5">
                        {booked + held}/{totalCap}
                      </div>
                    </div>
                  )}
                  <DepartureStatusBadge status={dep.status} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
