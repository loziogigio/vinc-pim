"use client";

import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type CalendarView = "day" | "month" | "week";

interface CalendarViewSelectorProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export function CalendarViewSelector({ view, onViewChange }: CalendarViewSelectorProps) {
  const { t } = useTranslation();

  const options: { value: CalendarView; label: string }[] = [
    { value: "month", label: t("pages.bookings.departures.month") },
    { value: "week", label: t("pages.bookings.departures.week") },
    { value: "day", label: t("pages.bookings.departures.day") },
  ];

  return (
    <div className="inline-flex rounded-[0.358rem] border border-[#ebe9f1] bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onViewChange(opt.value)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-[0.258rem] transition",
            view === opt.value
              ? "bg-[rgba(0,150,136,0.12)] text-[#009688]"
              : "text-[#b9b9c3] hover:text-[#5e5873]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
