"use client";

import { CalendarDays, List } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

type ViewMode = "calendar" | "list";

interface DepartureViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function DepartureViewToggle({ view, onViewChange }: DepartureViewToggleProps) {
  const { t } = useTranslation();

  const options: { value: ViewMode; label: string; icon: typeof CalendarDays }[] = [
    { value: "calendar", label: t("pages.bookings.departures.calendar"), icon: CalendarDays },
    { value: "list", label: t("pages.bookings.departures.list"), icon: List },
  ];

  return (
    <div className="inline-flex rounded-[0.428rem] border border-[#ebe9f1] bg-white p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => onViewChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-[0.358rem] px-3 py-1.5 text-sm font-medium transition",
              view === opt.value
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688]"
                : "text-[#b9b9c3] hover:text-[#5e5873]"
            )}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
