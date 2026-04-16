"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DepartureStatusBadge } from "./DepartureStatusBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DepartureStatus } from "@/lib/constants/booking";

interface CalendarDeparture {
  departure_id: string;
  label: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
}

interface DeparturesCalendarWeekProps {
  departures: CalendarDeparture[];
  currentDate: Date;
  tenantPrefix: string;
  onDateChange: (date: Date) => void;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  let dow = d.getDay() - 1;
  if (dow < 0) dow = 6;
  d.setDate(d.getDate() - dow);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const dateFormat = new Intl.DateTimeFormat("default", { weekday: "short", day: "numeric", month: "short" });

export function DeparturesCalendarWeek({
  departures,
  currentDate,
  tenantPrefix,
  onDateChange,
}: DeparturesCalendarWeekProps) {
  const { t } = useTranslation();

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const weekLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("default", { day: "numeric", month: "short" });
    return `${fmt.format(weekDays[0])} — ${fmt.format(weekDays[6])}`;
  }, [weekDays]);

  const departuresByDate = useMemo(() => {
    const map = new Map<string, CalendarDeparture[]>();
    for (const dep of departures) {
      const key = dep.starts_at.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(dep);
    }
    return map;
  }, [departures]);

  const prevWeek = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    onDateChange(d);
  }, [currentDate, onDateChange]);

  const nextWeek = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    onDateChange(d);
  }, [currentDate, onDateChange]);

  const goToday = useCallback(() => {
    onDateChange(new Date());
  }, [onDateChange]);

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={goToday} className="rounded-[0.358rem] px-3 py-1.5 text-xs font-medium text-[#009688] border border-[#009688] hover:bg-[rgba(0,150,136,0.08)] transition">
          {t("pages.bookings.departures.today")}
        </button>
        <button onClick={prevWeek} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-[#5e5873] min-w-[160px] text-center">
          {weekLabel}
        </span>
        <button onClick={nextWeek} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week grid */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => {
            const dateKey = day.toISOString().split("T")[0];
            const dayDeps = departuresByDate.get(dateKey) || [];
            const today = isSameDay(day, new Date());

            return (
              <div key={i} className="border-r border-[#ebe9f1] last:border-r-0 min-h-[200px]">
                {/* Day header */}
                <div className={`px-2 py-2 border-b border-[#ebe9f1] text-center ${today ? "bg-teal-50" : "bg-[#fafafc]"}`}>
                  <div className={`text-xs font-semibold ${today ? "text-[#009688]" : "text-[#5e5873]"}`}>
                    {dateFormat.format(day)}
                  </div>
                </div>
                {/* Events */}
                <div className="p-1.5 space-y-1">
                  {dayDeps.map((dep) => (
                    <Link
                      key={dep.departure_id}
                      href={`${tenantPrefix}/b2b/bookings/departures/${dep.departure_id}`}
                      className="block rounded-[0.258rem] p-1.5 text-xs hover:opacity-80 transition bg-teal-50 border-l-2 border-teal-500"
                    >
                      <div className="font-medium text-[#5e5873] truncate">{dep.label}</div>
                      <DepartureStatusBadge status={dep.status} size="sm" />
                    </Link>
                  ))}
                  {dayDeps.length === 0 && (
                    <div className="text-[10px] text-[#d5d5dc] text-center pt-4">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
