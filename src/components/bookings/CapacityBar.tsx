"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";

interface CapacityBarProps {
  total: number;
  available: number;
  held: number;
  booked: number;
  showLabels?: boolean;
  height?: "sm" | "md";
}

export function CapacityBar({
  total,
  available,
  held,
  booked,
  showLabels = false,
  height = "sm",
}: CapacityBarProps) {
  const { t } = useTranslation();

  if (total === 0) return null;

  const bookedPct = (booked / total) * 100;
  const heldPct = (held / total) * 100;
  const availablePct = (available / total) * 100;
  const barH = height === "sm" ? "h-2" : "h-3";

  return (
    <div className="w-full">
      <div className={`flex ${barH} rounded-full overflow-hidden bg-gray-100`}>
        {bookedPct > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${bookedPct}%` }}
            title={`${t("pages.bookings.capacity.booked")}: ${booked}`}
          />
        )}
        {heldPct > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${heldPct}%` }}
            title={`${t("pages.bookings.capacity.held")}: ${held}`}
          />
        )}
        {availablePct > 0 && (
          <div
            className="bg-gray-200 transition-all"
            style={{ width: `${availablePct}%` }}
            title={`${t("pages.bookings.capacity.available")}: ${available}`}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1.5 text-xs text-[#b9b9c3]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            {t("pages.bookings.capacity.booked")} {booked}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            {t("pages.bookings.capacity.held")} {held}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-200" />
            {t("pages.bookings.capacity.available")} {available}
          </span>
        </div>
      )}
    </div>
  );
}
