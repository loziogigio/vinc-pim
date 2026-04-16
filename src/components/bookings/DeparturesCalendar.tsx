"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DepartureStatusBadge } from "./DepartureStatusBadge";
import { CalendarViewSelector, type CalendarView } from "./CalendarViewSelector";
import { DeparturesCalendarWeek } from "./DeparturesCalendarWeek";
import { DeparturesCalendarDay } from "./DeparturesCalendarDay";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DepartureStatus } from "@/lib/constants/booking";

interface CalendarDeparture {
  departure_id: string;
  label: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
}

interface DeparturesCalendarProps {
  statusFilter?: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCalendarGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDow);

  const weeks: Date[][] = [];
  const current = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    // Stop if we've passed the last day of the month and filled enough rows
    if (current > lastDay && w >= 3) break;
  }

  return weeks;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function DeparturesCalendar({ statusFilter }: DeparturesCalendarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [calView, setCalView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [departures, setDepartures] = useState<CalendarDeparture[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("default", { month: "long", year: "numeric" }).format(currentDate);
  }, [currentDate]);

  // Fetch departures for the visible range
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const rangeStart = new Date(year, month, 1);
      const rangeEnd = new Date(year, month + 1, 0);

      const params = new URLSearchParams({
        date_from: rangeStart.toISOString().split("T")[0],
        date_to: rangeEnd.toISOString().split("T")[0],
        limit: "200",
      });
      if (statusFilter) params.set("status", statusFilter);

      try {
        const res = await fetch(`/api/b2b/departures?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDepartures(data.data?.departures || []);
        }
      } catch (error) {
        console.error("Error fetching calendar departures:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [year, month, statusFilter]);

  const weeks = useMemo(() => getCalendarGrid(year, month), [year, month]);

  // Group departures by date string (YYYY-MM-DD)
  const departuresByDate = useMemo(() => {
    const map = new Map<string, CalendarDeparture[]>();
    for (const dep of departures) {
      const key = dep.starts_at.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(dep);
    }
    return map;
  }, [departures]);

  const prevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const nextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  if (calView === "day") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <CalendarViewSelector view={calView} onViewChange={setCalView} />
        </div>
        <DeparturesCalendarDay
          departures={departures}
          currentDate={currentDate}
          tenantPrefix={tenantPrefix}
          onDateChange={setCurrentDate}
        />
      </div>
    );
  }

  if (calView === "week") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <CalendarViewSelector view={calView} onViewChange={setCalView} />
        </div>
        <DeparturesCalendarWeek
          departures={departures}
          currentDate={currentDate}
          tenantPrefix={tenantPrefix}
          onDateChange={setCurrentDate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <CalendarViewSelector view={calView} onViewChange={setCalView} />
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="rounded-[0.358rem] px-3 py-1.5 text-xs font-medium text-[#009688] border border-[#009688] hover:bg-[rgba(0,150,136,0.08)] transition">
            {t("pages.bookings.departures.today")}
          </button>
          <button onClick={prevMonth} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-[#5e5873] min-w-[140px] text-center capitalize">
            {monthLabel}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#ebe9f1] bg-[#fafafc]">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-[#5e5873] uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[#ebe9f1] last:border-0">
            {week.map((day, di) => {
              const dateKey = day.toISOString().split("T")[0];
              const dayDeps = departuresByDate.get(dateKey) || [];
              const isCurrentMonth = day.getMonth() === month;
              const today = isToday(day);

              return (
                <div
                  key={di}
                  className={`min-h-[90px] border-r border-[#ebe9f1] last:border-r-0 p-1.5 ${
                    isCurrentMonth ? "bg-white" : "bg-[#fafafc]"
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    today
                      ? "bg-[#009688] text-white rounded-full w-6 h-6 flex items-center justify-center"
                      : isCurrentMonth ? "text-[#5e5873]" : "text-[#d5d5dc]"
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayDeps.slice(0, 3).map((dep) => (
                      <Link
                        key={dep.departure_id}
                        href={`${tenantPrefix}/b2b/bookings/departures/${dep.departure_id}`}
                        className="block truncate rounded px-1 py-0.5 text-[10px] font-medium hover:opacity-80 transition bg-teal-50 text-teal-700 border-l-2 border-teal-500"
                        title={dep.label}
                      >
                        {dep.label}
                      </Link>
                    ))}
                    {dayDeps.length > 3 && (
                      <span className="text-[10px] text-[#b9b9c3] pl-1">
                        +{dayDeps.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <span className="text-sm text-[#b9b9c3]">Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}
